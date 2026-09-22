import { buildRuntime } from "./bootstrap.js";
import { loadConfig } from "./infrastructure/config.js";
import { loadLocalEnv } from "./infrastructure/load-local-env.js";
import { buildLoggerOptions } from "./infrastructure/logger-config.js";
import { buildApp } from "./interfaces/http/app.js";

async function main(): Promise<void> {
  loadLocalEnv();
  const config = loadConfig();
  const runtime = buildRuntime(config);

  const app = buildApp({
    respondUseCase: runtime.respondUseCase,
    dataLifecycleUseCase: runtime.dataLifecycleUseCase,
    readiness: runtime.readiness,
    logger: buildLoggerOptions(config.LOG_LEVEL),
  });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "Shutting down");
    await app.close();
    await runtime.close();
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
