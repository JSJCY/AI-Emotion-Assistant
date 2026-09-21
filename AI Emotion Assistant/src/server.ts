import { RespondUseCase } from "./application/respond-use-case.js";
import { loadConfig } from "./infrastructure/config.js";
import {
  DisabledResponseGenerator,
  DisabledRiskClassifier,
} from "./infrastructure/disabled-model-adapters.js";
import {
  BlockAllOutputAuditor,
  NoopEventRepository,
} from "./infrastructure/safe-default-adapters.js";
import { SystemClock } from "./infrastructure/system-clock.js";
import { buildApp } from "./interfaces/http/app.js";

async function main(): Promise<void> {
  const config = loadConfig();

  if (config.MODEL_PROVIDER !== "disabled") {
    throw new Error("MODEL_PROVIDER=dashscope is reserved for the next implementation increment.");
  }

  const respondUseCase = new RespondUseCase({
    riskClassifier: new DisabledRiskClassifier(),
    responseGenerator: new DisabledResponseGenerator(),
    outputAuditor: new BlockAllOutputAuditor(),
    eventRepository: new NoopEventRepository(),
    clock: new SystemClock(),
  });

  const app = buildApp({
    respondUseCase,
    readiness: {
      modelProvider: false,
      eventStore: false,
    },
    logger: {
      level: config.LOG_LEVEL,
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie"],
        censor: "[REDACTED]",
      },
    },
  });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "Shutting down");
    await app.close();
    process.exitCode = 0;
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ host: config.HOST, port: config.PORT });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  process.stderr.write(`Startup failed: ${message}\n`);
  process.exitCode = 1;
});
