import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  DeleteEventsCommand,
  DeletionReceipt,
  EventRepositoryPort,
  ResponseEvent,
} from "../application/ports.js";

const CURRENT_SCHEMA_VERSION = 2;

export class SqliteEventRepository implements EventRepositoryPort {
  private readonly database: DatabaseSync;
  private closed = false;

  constructor(databasePath: string) {
    if (databasePath !== ":memory:") {
      mkdirSync(dirname(resolve(databasePath)), { recursive: true });
    }

    this.database = new DatabaseSync(databasePath);
    try {
      this.configure();
      this.migrate();
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  recordResponse(event: ResponseEvent): Promise<void> {
    this.assertOpen();
    this.database
      .prepare(`
        INSERT INTO response_events (
          request_id,
          anonymous_id_hash,
          risk_level,
          signal_codes_json,
          route,
          safety_action,
          duration_ms,
          app_version,
          risk_policy_version,
          response_prompt_version,
          model_provider,
          risk_model,
          generation_model,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        event.requestId,
        event.anonymousIdHash,
        event.riskLevel,
        JSON.stringify(event.signalCodes),
        event.route,
        event.safetyAction,
        event.durationMs,
        event.appVersion,
        event.riskPolicyVersion,
        event.responsePromptVersion,
        event.modelProvider,
        event.riskModel,
        event.generationModel,
        event.createdAt,
      );
    return Promise.resolve();
  }

  listResponses(anonymousIdHash: string): Promise<readonly ResponseEvent[]> {
    this.assertOpen();
    const rows = this.database
      .prepare(`
        SELECT
          request_id,
          anonymous_id_hash,
          risk_level,
          signal_codes_json,
          route,
          safety_action,
          duration_ms,
          app_version,
          risk_policy_version,
          response_prompt_version,
          model_provider,
          risk_model,
          generation_model,
          created_at
        FROM response_events
        WHERE anonymous_id_hash = ?
        ORDER BY created_at ASC, request_id ASC
      `)
      .all(anonymousIdHash) as unknown as StoredResponseEventRow[];

    return Promise.resolve(rows.map(mapStoredResponseEvent));
  }

  deleteResponses(command: DeleteEventsCommand): Promise<DeletionReceipt> {
    this.assertOpen();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.database
        .prepare("DELETE FROM response_events WHERE anonymous_id_hash = ?")
        .run(command.anonymousIdHash);
      const deletedEventCount = Number(result.changes);
      this.database
        .prepare(`
          INSERT INTO deletion_receipts (
            receipt_id,
            anonymous_id_hash,
            scope,
            deleted_event_count,
            completed_at
          ) VALUES (?, ?, 'response_events', ?, ?)
        `)
        .run(command.receiptId, command.anonymousIdHash, deletedEventCount, command.completedAt);
      this.database.exec("COMMIT");
      return Promise.resolve({
        receiptId: command.receiptId,
        scope: "response_events",
        deletedEventCount,
        completedAt: command.completedAt,
      });
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  isReady(): Promise<boolean> {
    if (this.closed) {
      return Promise.resolve(false);
    }

    try {
      const row = this.database.prepare("SELECT 1 AS ok").get() as { ok?: number } | undefined;
      return Promise.resolve(row?.ok === 1);
    } catch {
      return Promise.resolve(false);
    }
  }

  close(): Promise<void> {
    if (!this.closed) {
      this.database.close();
      this.closed = true;
    }
    return Promise.resolve();
  }

  private configure(): void {
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec("PRAGMA synchronous = NORMAL");
    if (this.database.location() !== null) {
      this.database.exec("PRAGMA journal_mode = WAL");
    }
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);

    const row = this.database
      .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations")
      .get() as { version?: number } | undefined;
    const currentVersion = row?.version ?? 0;

    if (currentVersion > CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `Event database schema ${currentVersion} is newer than supported ${CURRENT_SCHEMA_VERSION}.`,
      );
    }

    if (currentVersion < 1) {
      this.database.exec("BEGIN IMMEDIATE");
      try {
        this.database.exec(`
          CREATE TABLE response_events (
            request_id TEXT PRIMARY KEY,
            anonymous_id_hash TEXT,
            risk_level TEXT NOT NULL CHECK (risk_level IN ('L0', 'L1', 'L2', 'L3')),
            signal_codes_json TEXT NOT NULL CHECK (json_valid(signal_codes_json)),
            route TEXT NOT NULL CHECK (
              route IN ('NORMAL', 'PRO_SUPPORT', 'SAFETY_CHECK', 'EMERGENCY_CN', 'MINOR_BOUNDARY')
            ),
            safety_action TEXT NOT NULL CHECK (
              safety_action IN (
                'NONE',
                'SHOW_PRO_SUPPORT',
                'ASK_IMMEDIATE_DANGER',
                'SHOW_EMERGENCY_CN',
                'SHOW_MINOR_BOUNDARY'
              )
            ),
            duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
            app_version TEXT NOT NULL,
            risk_policy_version TEXT NOT NULL,
            response_prompt_version TEXT NOT NULL,
            model_provider TEXT NOT NULL CHECK (model_provider IN ('disabled', 'dashscope')),
            risk_model TEXT,
            generation_model TEXT,
            created_at TEXT NOT NULL
          ) STRICT;

          CREATE INDEX response_events_created_at_idx ON response_events(created_at);
          CREATE INDEX response_events_anonymous_id_hash_idx
            ON response_events(anonymous_id_hash)
            WHERE anonymous_id_hash IS NOT NULL;
        `);
        this.database
          .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
          .run(1, new Date().toISOString());
        this.database.exec("COMMIT");
      } catch (error) {
        this.database.exec("ROLLBACK");
        throw error;
      }
    }

    if (currentVersion < 2) {
      this.database.exec("BEGIN IMMEDIATE");
      try {
        this.database.exec(`
          CREATE TABLE deletion_receipts (
            receipt_id TEXT PRIMARY KEY,
            anonymous_id_hash TEXT NOT NULL,
            scope TEXT NOT NULL CHECK (scope = 'response_events'),
            deleted_event_count INTEGER NOT NULL CHECK (deleted_event_count >= 0),
            completed_at TEXT NOT NULL
          ) STRICT;

          CREATE INDEX deletion_receipts_anonymous_id_hash_idx
            ON deletion_receipts(anonymous_id_hash);
        `);
        this.database
          .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
          .run(2, new Date().toISOString());
        this.database.exec("COMMIT");
      } catch (error) {
        this.database.exec("ROLLBACK");
        throw error;
      }
    }
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error("Event repository is closed.");
    }
  }
}

interface StoredResponseEventRow {
  readonly request_id: string;
  readonly anonymous_id_hash: string | null;
  readonly risk_level: ResponseEvent["riskLevel"];
  readonly signal_codes_json: string;
  readonly route: ResponseEvent["route"];
  readonly safety_action: ResponseEvent["safetyAction"];
  readonly duration_ms: number;
  readonly app_version: string;
  readonly risk_policy_version: string;
  readonly response_prompt_version: string;
  readonly model_provider: ResponseEvent["modelProvider"];
  readonly risk_model: string | null;
  readonly generation_model: string | null;
  readonly created_at: string;
}

function mapStoredResponseEvent(row: StoredResponseEventRow): ResponseEvent {
  return {
    requestId: row.request_id,
    anonymousIdHash: row.anonymous_id_hash,
    riskLevel: row.risk_level,
    signalCodes: JSON.parse(row.signal_codes_json) as ResponseEvent["signalCodes"],
    route: row.route,
    safetyAction: row.safety_action,
    durationMs: row.duration_ms,
    appVersion: row.app_version,
    riskPolicyVersion: row.risk_policy_version,
    responsePromptVersion: row.response_prompt_version,
    modelProvider: row.model_provider,
    riskModel: row.risk_model,
    generationModel: row.generation_model,
    createdAt: row.created_at,
  };
}
