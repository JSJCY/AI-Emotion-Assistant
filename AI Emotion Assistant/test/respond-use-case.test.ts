import { describe, expect, it, vi } from "vitest";
import type {
  ClockPort,
  EventRepositoryPort,
  OutputAuditorPort,
  ResponseGeneratorPort,
  RiskClassifierPort,
} from "../src/application/ports.js";
import { RespondUseCase } from "../src/application/respond-use-case.js";
import type { RiskAssessment } from "../src/domain/risk.js";

const l0Assessment: RiskAssessment = {
  level: "L0",
  signals: ["NONE"],
  immediateDanger: false,
  source: "risk_model",
};

function createDependencies() {
  const riskClassifier: RiskClassifierPort = {
    classify: vi.fn().mockResolvedValue(l0Assessment),
  };
  const responseGenerator: ResponseGeneratorPort = {
    generate: vi.fn().mockResolvedValue({
      strategy: "listen",
      acknowledgement: "这件事让你很难受。",
      known_facts: ["你今天在会议中被否定。"],
      unverified_inferences: [],
      question: "你想先继续说说，还是一起想下一步？",
      artifact: { type: "none", content: { title: null, body: null, steps: [] } },
      safety_action: "NONE",
    }),
  };
  const outputAuditor: OutputAuditorPort = {
    audit: vi.fn().mockResolvedValue({ safe: true, signals: [] }),
  };
  const eventRepository: EventRepositoryPort = {
    recordResponse: vi.fn().mockResolvedValue(undefined),
    listResponses: vi.fn().mockResolvedValue([]),
    deleteResponses: vi.fn().mockImplementation((command) =>
      Promise.resolve({
        receiptId: command.receiptId,
        scope: "response_events",
        deletedEventCount: 0,
        completedAt: command.completedAt,
      }),
    ),
    isReady: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const clock: ClockPort = {
    now: () => new Date("2026-09-21T00:00:00.000Z"),
    monotonicMs: vi.fn().mockReturnValueOnce(100).mockReturnValue(125),
  };

  return {
    riskClassifier,
    responseGenerator,
    outputAuditor,
    eventRepository,
    eventMetadata: {
      appVersion: "test",
      riskPolicyVersion: "risk-policy-test",
      responsePromptVersion: "response-prompt-test",
      modelProvider: "disabled" as const,
      riskModel: null,
      generationModel: null,
    },
    clock,
  };
}

describe("RespondUseCase", () => {
  it("short-circuits model calls when local rules detect immediate danger", async () => {
    const dependencies = createDependencies();
    const useCase = new RespondUseCase(dependencies);

    const response = await useCase.execute({
      requestId: "req-high-risk",
      message: "我已经决定今晚结束一切，身边也没有人。",
      context: [],
    });

    expect(response.route).toBe("EMERGENCY_CN");
    expect(response.risk_level).toBe("L3");
    expect(dependencies.riskClassifier.classify).not.toHaveBeenCalled();
    expect(dependencies.responseGenerator.generate).not.toHaveBeenCalled();
    expect(dependencies.eventRepository.recordResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req-high-risk",
        riskLevel: "L3",
        route: "EMERGENCY_CN",
      }),
    );
  });

  it("lets the independent classifier elevate an apparently normal message", async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.riskClassifier.classify).mockResolvedValue({
      level: "L2",
      signals: ["SELF_HARM"],
      immediateDanger: false,
      source: "risk_model",
    });
    const useCase = new RespondUseCase(dependencies);

    const response = await useCase.execute({
      requestId: "req-elevated",
      message: "我不知道该怎么办。",
      context: [],
    });

    expect(response.route).toBe("SAFETY_CHECK");
    expect(dependencies.responseGenerator.generate).not.toHaveBeenCalled();
  });

  it("returns a schema-shaped normal response after generation and audit", async () => {
    const dependencies = createDependencies();
    const useCase = new RespondUseCase(dependencies);

    const response = await useCase.execute({
      requestId: "req-normal",
      message: "今天开会时我被否定了，很难受。",
      context: [],
      preferredStrategy: "listen",
    });

    expect(response).toMatchObject({
      request_id: "req-normal",
      route: "NORMAL",
      risk_level: "L0",
      strategy: "listen",
      safety_action: "NONE",
    });
    expect(dependencies.outputAuditor.audit).toHaveBeenCalledOnce();
  });

  it("blocks generated content that fails output audit", async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.outputAuditor.audit).mockResolvedValue({
      safe: false,
      signals: ["HARM_OTHERS"],
    });
    const useCase = new RespondUseCase(dependencies);

    await expect(
      useCase.execute({ requestId: "req-unsafe", message: "帮我想想怎么表达。", context: [] }),
    ).rejects.toMatchObject({ code: "UNSAFE_MODEL_OUTPUT", statusCode: 503 });
  });
});
