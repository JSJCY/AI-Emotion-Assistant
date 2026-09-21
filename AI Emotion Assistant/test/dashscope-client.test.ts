import { describe, expect, it, vi } from "vitest";
import { DashscopeJsonClient } from "../src/infrastructure/dashscope/json-completion-client.js";

const request = {
  model: "test-model",
  messages: [{ role: "user" as const, content: "synthetic test" }],
  responseSchema: {
    name: "test_schema",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { ok: { type: "boolean" } },
      required: ["ok"],
    },
  },
  temperature: 0,
  maxCompletionTokens: 100,
};

function successfulResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function createClient(fetchImplementation: typeof fetch, maxRetries = 0) {
  return new DashscopeJsonClient({
    apiKey: "test-key-not-real",
    baseUrl: "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
    timeoutMs: 1_000,
    maxRetries,
    fetchImplementation,
    sleep: vi.fn().mockResolvedValue(undefined),
  });
}

describe("DashscopeJsonClient", () => {
  it("sends non-thinking strict JSON Schema requests and parses content", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(successfulResponse('{"ok":true}'));
    const client = createClient(fetchMock);

    await expect(client.completeJson(request)).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
    );
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "test-model",
      enable_thinking: false,
      max_completion_tokens: 100,
      response_format: {
        type: "json_schema",
        json_schema: { name: "test_schema", strict: true },
      },
    });
  });

  it("retries one rate-limited request and then succeeds", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(successfulResponse('{"ok":true}'));
    const client = createClient(fetchMock, 1);

    await expect(client.completeJson(request)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a sanitized authentication error without provider body content", async () => {
    const secretProviderBody = "provider-debug-body-that-must-not-leak";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(secretProviderBody, { status: 401 }));
    const client = createClient(fetchMock);

    await expect(client.completeJson(request)).rejects.toMatchObject({
      code: "MODEL_PROVIDER_AUTH_FAILED",
      statusCode: 503,
    });
    await client.completeJson(request).catch((error: unknown) => {
      expect(String(error)).not.toContain(secretProviderBody);
    });
  });

  it("rejects malformed structured content", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(successfulResponse("not-json"));
    const client = createClient(fetchMock);

    await expect(client.completeJson(request)).rejects.toMatchObject({
      code: "MODEL_RESPONSE_INVALID",
      statusCode: 502,
    });
  });
});
