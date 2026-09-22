import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { EventRepositoryPort, ResponseEvent } from "../application/ports.js";

const CURRENT_SCHEMA_VERSION = 1;

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
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error("Event repository is closed.");
    }
  }
}
