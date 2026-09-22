import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import type { ResponseEvent } from "../src/application/ports.js";
import { SqliteEventRepository } from "../src/infrastructure/sqlite-event-repository.js";

const temporaryDirectories: string[] = [];

function createDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "emotion-event-store-"));
  temporaryDirectories.push(directory);
  return join(directory, "events.db");
}

function createEvent(overrides: Partial<ResponseEvent> = {}): ResponseEvent {
  return {
    requestId: "req-001",
    anonymousIdHash: null,
    riskLevel: "L1",
    signalCodes: ["DISTRESS"],
    route: "PRO_SUPPORT",
    safetyAction: "SHOW_PRO_SUPPORT",
    durationMs: 125,
    appVersion: "0.2.0",
    riskPolicyVersion: "risk-policy-v0.2",
    responsePromptVersion: "response-prompt-v0.1",
    modelProvider: "dashscope",
    riskModel: "qwen3.7-plus-2026-05-26",
    generationModel: "qwen3.7-plus-2026-05-26",
    createdAt: "2026-09-22T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("SqliteEventRepository", () => {
  it("persists only the approved response metadata fields", async () => {
    const databasePath = createDatabasePath();
    const repository = new SqliteEventRepository(databasePath);

    await repository.recordResponse(createEvent());
    await repository.close();

    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const columns = database.prepare("PRAGMA table_info(response_events)").all() as Array<{
        name: string;
      }>;
      const columnNames = columns.map((column) => column.name);
      expect(columnNames).not.toEqual(
        expect.arrayContaining([
          "message",
          "message_text",
          "context",
          "prompt",
          "response",
          "response_text",
          "acknowledgement",
          "known_facts",
        ]),
      );

      const row = database.prepare("SELECT * FROM response_events").get() as Record<
        string,
        unknown
      >;
      expect(row).toMatchObject({
        request_id: "req-001",
        anonymous_id_hash: null,
        risk_level: "L1",
        route: "PRO_SUPPORT",
        safety_action: "SHOW_PRO_SUPPORT",
        duration_ms: 125,
        model_provider: "dashscope",
      });
      expect(JSON.parse(String(row.signal_codes_json))).toEqual(["DISTRESS"]);
    } finally {
      database.close();
    }
  });

  it("applies migrations once and remains ready after reopening", async () => {
    const databasePath = createDatabasePath();
    const first = new SqliteEventRepository(databasePath);
    expect(await first.isReady()).toBe(true);
    await first.close();
    expect(await first.isReady()).toBe(false);

    const second = new SqliteEventRepository(databasePath);
    expect(await second.isReady()).toBe(true);
    await second.close();

    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const row = database
        .prepare("SELECT COUNT(*) AS count, MAX(version) AS version FROM schema_migrations")
        .get() as { count: number; version: number };
      expect(row).toEqual({ count: 2, version: 2 });
    } finally {
      database.close();
    }
  });

  it("exports matching metadata and atomically records deletion receipts", async () => {
    const databasePath = createDatabasePath();
    const repository = new SqliteEventRepository(databasePath);
    const anonymousIdHash = "a".repeat(64);
    await repository.recordResponse(createEvent({ anonymousIdHash }));
    await repository.recordResponse(
      createEvent({ requestId: "req-other", anonymousIdHash: "b".repeat(64) }),
    );

    const beforeDeletion = await repository.listResponses(anonymousIdHash);
    expect(beforeDeletion).toHaveLength(1);
    expect(beforeDeletion[0]).toMatchObject({ requestId: "req-001", anonymousIdHash });

    const receipt = await repository.deleteResponses({
      receiptId: "9f8c44e2-641f-4f7f-96d2-31b18e6fe211",
      anonymousIdHash,
      completedAt: "2026-09-22T01:00:00.000Z",
    });
    expect(receipt).toEqual({
      receiptId: "9f8c44e2-641f-4f7f-96d2-31b18e6fe211",
      scope: "response_events",
      deletedEventCount: 1,
      completedAt: "2026-09-22T01:00:00.000Z",
    });
    expect(await repository.listResponses(anonymousIdHash)).toEqual([]);
    expect(await repository.listResponses("b".repeat(64))).toHaveLength(1);
    await repository.close();

    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const storedReceipt = database.prepare("SELECT * FROM deletion_receipts").get() as {
        anonymous_id_hash: string;
        deleted_event_count: number;
      };
      expect(storedReceipt).toMatchObject({
        anonymous_id_hash: anonymousIdHash,
        deleted_event_count: 1,
      });
    } finally {
      database.close();
    }
  });
});
