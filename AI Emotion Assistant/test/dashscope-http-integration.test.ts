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
      }),
    );
    const app = buildApp({
      respondUseCase: runtime.respondUseCase,
      readiness: runtime.readiness,
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/respond",
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
    } finally {
      await app.close();
    }
  });
});
