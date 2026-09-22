import { DataLifecycleUseCase } from "./application/data-lifecycle-use-case.js";
import type { EventRepositoryPort, ResponseEventMetadata } from "./application/ports.js";
import { RespondUseCase } from "./application/respond-use-case.js";
import {
  RandomUuidGenerator,
  Sha256AnonymousIdentifierHasher,
} from "./infrastructure/anonymous-identifier.js";
import type { AppConfig } from "./infrastructure/config.js";
import { DashscopeJsonClient } from "./infrastructure/dashscope/json-completion-client.js";
import {
  DashscopeResponseGenerator,
  RESPONSE_PROMPT_VERSION,
} from "./infrastructure/dashscope/response-generator.js";
import {
  DashscopeRiskClassifier,
  RISK_CLASSIFIER_POLICY_VERSION,
} from "./infrastructure/dashscope/risk-classifier.js";
import { DeterministicOutputAuditor } from "./infrastructure/deterministic-output-auditor.js";
import {
  DisabledResponseGenerator,
  DisabledRiskClassifier,
} from "./infrastructure/disabled-model-adapters.js";
import { NoopEventRepository } from "./infrastructure/safe-default-adapters.js";
import { SqliteEventRepository } from "./infrastructure/sqlite-event-repository.js";
import { SystemClock } from "./infrastructure/system-clock.js";
import type { ReadinessState } from "./interfaces/http/app.js";

const APP_VERSION = "0.2.0";

export interface Runtime {
  readonly respondUseCase: RespondUseCase;
  readonly dataLifecycleUseCase: DataLifecycleUseCase;
  readonly readiness: ReadinessState;
  close(): Promise<void>;
}

export function buildRuntime(config: AppConfig): Runtime {
  const eventRepository = buildEventRepository(config);
  const outputAuditor = new DeterministicOutputAuditor();
  const eventMetadata = buildEventMetadata(config);
  const dataLifecycleUseCase = new DataLifecycleUseCase({
    eventRepository,
    identifierHasher: new Sha256AnonymousIdentifierHasher(),
    idGenerator: new RandomUuidGenerator(),
    clock: new SystemClock(),
  });

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
        eventMetadata,
        clock: new SystemClock(),
      }),
      dataLifecycleUseCase,
      readiness: {
        modelProvider: true,
        eventStore: () => eventRepository.isReady(),
      },
      close: () => eventRepository.close(),
    };
  }

  return {
    respondUseCase: new RespondUseCase({
      riskClassifier: new DisabledRiskClassifier(),
      responseGenerator: new DisabledResponseGenerator(),
      outputAuditor,
      eventRepository,
      eventMetadata,
      clock: new SystemClock(),
    }),
    dataLifecycleUseCase,
    readiness: {
      modelProvider: false,
      eventStore: () => eventRepository.isReady(),
    },
    close: () => eventRepository.close(),
  };
}

function buildEventRepository(config: AppConfig): EventRepositoryPort {
  return config.EVENT_STORE === "sqlite"
    ? new SqliteEventRepository(config.EVENT_DB_PATH)
    : new NoopEventRepository();
}

function buildEventMetadata(config: AppConfig): ResponseEventMetadata {
  return {
    appVersion: APP_VERSION,
    riskPolicyVersion: RISK_CLASSIFIER_POLICY_VERSION,
    responsePromptVersion: RESPONSE_PROMPT_VERSION,
    modelProvider: config.MODEL_PROVIDER,
    riskModel: config.MODEL_PROVIDER === "dashscope" ? config.DASHSCOPE_RISK_MODEL : null,
    generationModel:
      config.MODEL_PROVIDER === "dashscope" ? config.DASHSCOPE_GENERATION_MODEL : null,
  };
}

function requireConfigured(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new Error(`${name} is required for the configured model provider.`);
  }
  return value;
}
