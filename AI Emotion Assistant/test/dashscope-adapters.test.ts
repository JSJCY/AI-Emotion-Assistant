import { describe, expect, it, vi } from "vitest";
import type { JsonCompletionClientPort } from "../src/infrastructure/dashscope/json-completion-client.js";
import { DashscopeResponseGenerator } from "../src/infrastructure/dashscope/response-generator.js";
import { DashscopeRiskClassifier } from "../src/infrastructure/dashscope/risk-classifier.js";

describe("DashScope model adapters", () => {
  it("elevates immediate danger to L3 even if the raw level is lower", async () => {
    const client: JsonCompletionClientPort = {
      completeJson: vi.fn().mockResolvedValue({
        risk_level: "L1",
        signal_codes: ["SELF_HARM"],
        immediate_danger: true,
        needs_fixed_safety_flow: true,
        confidence: 0.92,
      }),
    };
    const classifier = new DashscopeRiskClassifier(client, "risk-model");

    const result = await classifier.classify({
      requestId: "request-1",
      message: "synthetic message",
      context: [],
    });

    expect(result).toMatchObject({
      level: "L3",
      signals: ["SELF_HARM"],
      immediateDanger: true,
      source: "risk_model",
    });
  });

  it("rejects risk output that does not satisfy the runtime schema", async () => {
    const client: JsonCompletionClientPort = {
      completeJson: vi.fn().mockResolvedValue({ risk_level: "UNKNOWN" }),
    };
    const classifier = new DashscopeRiskClassifier(client, "risk-model");

    await expect(
      classifier.classify({ requestId: "request-2", message: "synthetic", context: [] }),
    ).rejects.toMatchObject({ code: "MODEL_RESPONSE_INVALID", statusCode: 502 });
  });

  it("parses a schema-shaped support response", async () => {
    const client: JsonCompletionClientPort = {
      completeJson: vi.fn().mockResolvedValue({
        strategy: "act",
        acknowledgement: "你现在有些混乱，我们可以先做一个小步骤。",
        known_facts: ["你明天要汇报。"],
        unverified_inferences: [],
        question: null,
        artifact: {
          type: "action_card",
          content: { title: "下一步", body: null, steps: ["先列出三个要点。"] },
        },
        safety_action: "NONE",
      }),
    };
    const generator = new DashscopeResponseGenerator(client, "generation-model");

    const result = await generator.generate(
      {
        requestId: "request-3",
        message: "明天要汇报，我有点乱。",
        context: [],
        preferredStrategy: "act",
      },
      { level: "L0", signals: ["NONE"], immediateDanger: false, source: "risk_model" },
    );

    expect(result.strategy).toBe("act");
    expect(result.artifact.type).toBe("action_card");
  });
});
