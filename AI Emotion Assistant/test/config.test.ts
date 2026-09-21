import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/infrastructure/config.js";

describe("configuration", () => {
  it("starts in disabled provider mode without secrets", () => {
    const config = loadConfig({});

    expect(config.MODEL_PROVIDER).toBe("disabled");
    expect(config.DASHSCOPE_API_KEY).toBeUndefined();
  });

  it("rejects DashScope mode when credentials or workspace endpoint are missing", () => {
    expect(() => loadConfig({ MODEL_PROVIDER: "dashscope" })).toThrow();
  });

  it("accepts a workspace-specific Beijing endpoint without exposing the key", () => {
    const config = loadConfig({
      MODEL_PROVIDER: "dashscope",
      DASHSCOPE_API_KEY: "test-key-not-real",
      DASHSCOPE_BASE_URL: "https://workspace-id.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
    });

    expect(config.MODEL_PROVIDER).toBe("dashscope");
    expect(config.DASHSCOPE_RISK_MODEL).toBe("qwen3.7-plus-2026-05-26");
    expect(config.DASHSCOPE_GENERATION_MODEL).toBe("qwen3.7-plus-2026-05-26");
  });

  it("rejects the unchanged endpoint placeholder", () => {
    expect(() =>
      loadConfig({
        MODEL_PROVIDER: "dashscope",
        DASHSCOPE_API_KEY: "test-key-not-real",
        DASHSCOPE_BASE_URL:
          "https://YOUR_WORKSPACE_ID.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
      }),
    ).toThrow();
  });
});
