import Fastify, { type FastifyServerOptions } from "fastify";
import { ApplicationError } from "../../application/errors.js";
import type { RespondUseCase } from "../../application/respond-use-case.js";
import { respondRequestSchema, respondResultSchema } from "./schemas.js";

export interface ReadinessState {
  readonly modelProvider: boolean;
  readonly eventStore: boolean;
}

export interface BuildAppOptions {
  readonly respondUseCase: RespondUseCase;
  readonly readiness: ReadinessState;
  readonly logger?: FastifyServerOptions["logger"];
}

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 64 * 1024,
    requestIdHeader: "x-request-id",
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "ai-emotion-assistant",
    version: "0.2.0",
  }));

  app.get("/ready", async (_request, reply) => {
    const ready = options.readiness.modelProvider && options.readiness.eventStore;
    return reply.code(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      checks: {
        model_provider: options.readiness.modelProvider,
        event_store: options.readiness.eventStore,
      },
    });
  });

  app.post("/api/v1/respond", async (request, reply) => {
    const parsed = respondRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "INVALID_REQUEST",
          message: "The request body is invalid.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            code: issue.code,
          })),
        },
        request_id: request.id,
      });
    }

    const result = await options.respondUseCase.execute({
      requestId: request.id,
      message: parsed.data.message,
      context: parsed.data.context,
      ...(parsed.data.preferred_strategy === undefined
        ? {}
        : { preferredStrategy: parsed.data.preferred_strategy }),
    });

    return reply.code(200).send(respondResultSchema.parse(result));
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApplicationError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
        },
        request_id: request.id,
      });
    }

    request.log.error({ err: error, requestId: request.id }, "Unhandled request error");
    return reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
      request_id: request.id,
    });
  });

  return app;
}
