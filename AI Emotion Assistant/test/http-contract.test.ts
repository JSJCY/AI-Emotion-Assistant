import { afterEach, describe, expect, it } from "vitest";
import { RespondUseCase } from "../src/application/respond-use-case.js";
import {
  DisabledResponseGenerator,
  DisabledRiskClassifier,
} from "../src/infrastructure/disabled-model-adapters.js";
import {
  BlockAllOutputAuditor,
  NoopEventRepository,
} from "../src/infrastructure/safe-default-adapters.js";
import { SystemClock } from "../src/infrastructure/system-clock.js";
import { buildApp } from "../src/interfaces/http/app.js";

function createApp() {
  const useCase = new RespondUseCase({
    riskClassifier: new DisabledRiskClassifier(),
    responseGenerator: new DisabledResponseGenerator(),
    outputAuditor: new BlockAllOutputAuditor(),
    eventRepository: new NoopEventRepository(),
    eventMetadata: {
      appVersion: "test",
      riskPolicyVersion: "risk-policy-test",
      responsePromptVersion: "response-prompt-test",
      modelProvider: "disabled",
      riskModel: null,
      generationModel: null,
    },
    clock: new SystemClock(),
  });

  return buildApp({
    respondUseCase: useCase,
    readiness: { modelProvider: false, eventStore: () => Promise.resolve(false) },
  });
}

describe("HTTP contract", () => {
  const apps: ReturnType<typeof createApp>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("exposes liveness separately from dependency readiness", async () => {
    const app = createApp();
    apps.push(app);

    const health = await app.inject({ method: "GET", url: "/health" });
    const ready = await app.inject({ method: "GET", url: "/ready" });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ status: "ok", version: "0.2.0" });
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toMatchObject({
      status: "not_ready",
      checks: { model_provider: false, event_store: false },
    });
  });

  it("rejects invalid input without echoing the submitted content", async () => {
    const app = createApp();
    apps.push(app);
    const sensitiveText = "private-content-must-not-be-echoed";

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/respond",
      payload: { message: "", context: [{ role: "user", content: sensitiveText }] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain(sensitiveText);
    expect(response.json().error.code).toBe("INVALID_REQUEST");
  });

  it("serves a fixed emergency response before external model integration", async () => {
    const app = createApp();
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/respond",
      payload: { message: "我已经决定今晚结束一切，身边也没有人。" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      route: "EMERGENCY_CN",
      risk_level: "L3",
      safety_action: "SHOW_EMERGENCY_CN",
    });
  });

  it("fails closed for normal generation while the safety classifier is disabled", async () => {
    const app = createApp();
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/respond",
      payload: { message: "今天开会时被否定了，我有些难受。" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("SAFETY_CLASSIFIER_UNAVAILABLE");
  });
});
