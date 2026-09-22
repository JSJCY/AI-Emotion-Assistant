import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { DataLifecycleUseCase } from "../src/application/data-lifecycle-use-case.js";
import { RespondUseCase } from "../src/application/respond-use-case.js";
import {
  RandomUuidGenerator,
  Sha256AnonymousIdentifierHasher,
} from "../src/infrastructure/anonymous-identifier.js";
import {
  DisabledResponseGenerator,
  DisabledRiskClassifier,
} from "../src/infrastructure/disabled-model-adapters.js";
import { buildLoggerOptions, LOG_REDACTION_PATHS } from "../src/infrastructure/logger-config.js";
import {
  BlockAllOutputAuditor,
  NoopEventRepository,
} from "../src/infrastructure/safe-default-adapters.js";
import { SystemClock } from "../src/infrastructure/system-clock.js";
import { buildApp } from "../src/interfaces/http/app.js";

function createLoggedApp(chunks: string[]) {
  const eventRepository = new NoopEventRepository();
  const clock = new SystemClock();
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });

  return buildApp({
    respondUseCase: new RespondUseCase({
      riskClassifier: new DisabledRiskClassifier(),
      responseGenerator: new DisabledResponseGenerator(),
      outputAuditor: new BlockAllOutputAuditor(),
      eventRepository,
      eventMetadata: {
        appVersion: "test",
        riskPolicyVersion: "risk-policy-test",
        responsePromptVersion: "response-prompt-test",
        modelProvider: "disabled",
        riskModel: null,
        generationModel: null,
      },
      clock,
    }),
    dataLifecycleUseCase: new DataLifecycleUseCase({
      eventRepository,
      identifierHasher: new Sha256AnonymousIdentifierHasher(),
      idGenerator: new RandomUuidGenerator(),
      clock,
    }),
    readiness: { modelProvider: false, eventStore: () => Promise.resolve(false) },
    logger: { ...buildLoggerOptions("info"), stream },
  });
}

describe("privacy-safe logging", () => {
  const apps: ReturnType<typeof createLoggedApp>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("configures redaction for credentials, cookies, and anonymous identifiers", () => {
    expect(LOG_REDACTION_PATHS).toEqual([
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers.x-anonymous-id",
    ]);
    expect(buildLoggerOptions("info").redact.censor).toBe("[REDACTED]");
  });

  it("does not write request messages, context, or sensitive headers to logs", async () => {
    const chunks: string[] = [];
    const app = createLoggedApp(chunks);
    apps.push(app);
    const messageMarker = "MESSAGE_BODY_MUST_NOT_ENTER_LOGS";
    const contextMarker = "CONTEXT_BODY_MUST_NOT_ENTER_LOGS";
    const authorizationMarker = "AUTHORIZATION_MUST_NOT_ENTER_LOGS";
    const cookieMarker = "COOKIE_MUST_NOT_ENTER_LOGS";
    const anonymousId = "550e8400-e29b-41d4-a716-446655440000";

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/respond",
      headers: {
        authorization: `Bearer ${authorizationMarker}`,
        cookie: `session=${cookieMarker}`,
        "x-anonymous-id": anonymousId,
      },
      payload: {
        message: `我已经决定今晚结束一切。${messageMarker}`,
        context: [{ role: "user", content: contextMarker }],
      },
    });
    await app.close();
    apps.pop();

    expect(response.statusCode).toBe(200);
    const logs = chunks.join("");
    expect(logs).not.toContain(messageMarker);
    expect(logs).not.toContain(contextMarker);
    expect(logs).not.toContain(authorizationMarker);
    expect(logs).not.toContain(cookieMarker);
    expect(logs).not.toContain(anonymousId);
  });
});
