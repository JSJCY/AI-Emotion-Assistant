import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRuntime } from "../src/bootstrap.js";
import { loadConfig } from "../src/infrastructure/config.js";
import { buildApp } from "../src/interfaces/http/app.js";

function providerResponse(content: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(content) },
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("DashScope HTTP integration with mocked provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs classification, generation, output audit, and HTTP serialization end to end", async () => {
    const anonymousId = "550e8400-e29b-41d4-a716-446655440000";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        providerResponse({
          risk_level: "L0",
          signal_codes: ["NONE"],
          immediate_danger: false,
          needs_fixed_safety_flow: false,
          confidence: 0.95,
        }),
      )
      .mockResolvedValueOnce(
        providerResponse({
          strategy: "listen",
          acknowledgement: "被当众否定让你很难受。",
          known_facts: ["你说今天在会议中被否定。"],
          unverified_inferences: [],
          question: "你愿意先说说当时最难受的部分吗？",
          artifact: {
            type: "none",
            content: { title: null, body: null, steps: [] },
          },
          safety_action: "NONE",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const runtime = buildRuntime(
      loadConfig({
        MODEL_PROVIDER: "dashscope",
        DASHSCOPE_API_KEY: "test-key-not-real",
        DASHSCOPE_BASE_URL: "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
        EVENT_STORE: "sqlite",
        EVENT_DB_PATH: ":memory:",
      }),
    );
    const app = buildApp({
      respondUseCase: runtime.respondUseCase,
      dataLifecycleUseCase: runtime.dataLifecycleUseCase,
      readiness: runtime.readiness,
    });

    try {
      const ready = await app.inject({ method: "GET", url: "/ready" });
      expect(ready.statusCode).toBe(200);
      expect(ready.json()).toMatchObject({
        status: "ready",
        checks: { model_provider: true, event_store: true },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/respond",
        headers: { "x-anonymous-id": anonymousId },
        payload: {
          message: "今天开会时我被当众否定了，真的很难受。",
          preferred_strategy: "listen",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        route: "NORMAL",
        risk_level: "L0",
        strategy: "listen",
        artifact: {
          type: "none",
          content: { title: null, body: null, steps: [] },
        },
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const exported = await app.inject({
        method: "GET",
        url: "/api/v1/events/export",
        headers: { "x-anonymous-id": anonymousId },
      });
      expect(exported.statusCode).toBe(200);
      expect(exported.body).not.toContain(anonymousId);
      expect(exported.body).not.toContain("今天开会时我被当众否定了");
      expect(exported.json()).toMatchObject({
        version: "event-export-v1",
        events: [
          {
            risk_level: "L0",
            signal_codes: ["NONE"],
            route: "NORMAL",
            model_provider: "dashscope",
          },
        ],
      });

      const deleted = await app.inject({
        method: "DELETE",
        url: "/api/v1/events",
        headers: { "x-anonymous-id": anonymousId },
      });
      expect(deleted.statusCode).toBe(200);
      expect(deleted.json()).toMatchObject({
        version: "deletion-receipt-v1",
        scope: "response_events",
        deleted_event_count: 1,
      });

      const afterDeletion = await app.inject({
        method: "GET",
        url: "/api/v1/events/export",
        headers: { "x-anonymous-id": anonymousId },
      });
      expect(afterDeletion.statusCode).toBe(200);
      expect(afterDeletion.json().events).toEqual([]);
    } finally {
      await app.close();
      await runtime.close();
    }
  });
});
