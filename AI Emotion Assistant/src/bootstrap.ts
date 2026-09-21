import { RespondUseCase } from "./application/respond-use-case.js";
import type { AppConfig } from "./infrastructure/config.js";
import { DashscopeJsonClient } from "./infrastructure/dashscope/json-completion-client.js";
import { DashscopeResponseGenerator } from "./infrastructure/dashscope/response-generator.js";
import { DashscopeRiskClassifier } from "./infrastructure/dashscope/risk-classifier.js";
import { DeterministicOutputAuditor } from "./infrastructure/deterministic-output-auditor.js";
import {
  DisabledResponseGenerator,
  DisabledRiskClassifier,
} from "./infrastructure/disabled-model-adapters.js";
import { NoopEventRepository } from "./infrastructure/safe-default-adapters.js";
import { SystemClock } from "./infrastructure/system-clock.js";
import type { ReadinessState } from "./interfaces/http/app.js";

export interface Runtime {
  readonly respondUseCase: RespondUseCase;
  readonly readiness: ReadinessState;
}

export function buildRuntime(config: AppConfig): Runtime {
  const eventRepository = new NoopEventRepository();
  const outputAuditor = new DeterministicOutputAuditor();

  if (config.MODEL_PROVIDER === "dashscope") {
    const client = new DashscopeJsonClient({
      apiKey: requireConfigured(config.DASHSCOPE_API_KEY, "DASHSCOPE_API_KEY"),
      baseUrl: requireConfigured(config.DASHSCOPE_BASE_URL, "DASHSCOPE_BASE_URL"),
      timeoutMs: config.MODEL_TIMEOUT_MS,
      maxRetries: config.MODEL_MAX_RETRIES,
    });

    return {
      respondUseCase: new RespondUseCase({
        riskClassifier: new DashscopeRiskClassifier(client, config.DASHSCOPE_RISK_MODEL),
        responseGenerator: new DashscopeResponseGenerator(
          client,
          config.DASHSCOPE_GENERATION_MODEL,
        ),
        outputAuditor,
        eventRepository,
        clock: new SystemClock(),
      }),
      readiness: { modelProvider: true, eventStore: false },
    };
  }

  return {
    respondUseCase: new RespondUseCase({
      riskClassifier: new DisabledRiskClassifier(),
      responseGenerator: new DisabledResponseGenerator(),
      outputAuditor,
      eventRepository,
      clock: new SystemClock(),
    }),
    readiness: { modelProvider: false, eventStore: false },
  };
}

function requireConfigured(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new Error(`${name} is required for the configured model provider.`);
  }
  return value;
}
