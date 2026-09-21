import { buildRuntime } from "./bootstrap.js";
import { loadConfig } from "./infrastructure/config.js";
import { loadLocalEnv } from "./infrastructure/load-local-env.js";
import { buildApp } from "./interfaces/http/app.js";

async function main(): Promise<void> {
  loadLocalEnv();
  const config = loadConfig();
  const runtime = buildRuntime(config);

  const app = buildApp({
    respondUseCase: runtime.respondUseCase,
    readiness: runtime.readiness,
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
