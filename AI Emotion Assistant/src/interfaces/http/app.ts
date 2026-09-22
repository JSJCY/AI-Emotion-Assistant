import Fastify, { type FastifyReply, type FastifyServerOptions } from "fastify";
import type { DataLifecycleUseCase } from "../../application/data-lifecycle-use-case.js";
import { ApplicationError } from "../../application/errors.js";
import type { RespondUseCase } from "../../application/respond-use-case.js";
import { APP_VERSION } from "../../version.js";
import {
  anonymousIdSchema,
  deletionReceiptSchema,
  eventExportResultSchema,
  respondRequestSchema,
  respondResultSchema,
} from "./schemas.js";

export interface ReadinessState {
  readonly modelProvider: boolean;
  readonly eventStore: () => Promise<boolean>;
}

export interface BuildAppOptions {
  readonly respondUseCase: RespondUseCase;
  readonly dataLifecycleUseCase: DataLifecycleUseCase;
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
    version: APP_VERSION,
  }));

  app.get("/ready", async (_request, reply) => {
    const eventStoreReady = await options.readiness.eventStore();
    const ready = options.readiness.modelProvider && eventStoreReady;
    return reply.code(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      checks: {
        model_provider: options.readiness.modelProvider,
        event_store: eventStoreReady,
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

    const anonymousId = parseAnonymousIdHeader(request.headers["x-anonymous-id"]);
    if (anonymousId === "invalid") {
      return invalidAnonymousIdResponse(reply, request.id);
    }

    const result = await options.respondUseCase.execute({
      requestId: request.id,
      message: parsed.data.message,
      context: parsed.data.context,
      ...(anonymousId === undefined
        ? {}
        : { anonymousIdHash: options.dataLifecycleUseCase.hashAnonymousId(anonymousId) }),
      ...(parsed.data.preferred_strategy === undefined
        ? {}
        : { preferredStrategy: parsed.data.preferred_strategy }),
    });

    return reply.code(200).send(respondResultSchema.parse(result));
  });

  app.get("/api/v1/events/export", async (request, reply) => {
    const anonymousId = parseAnonymousIdHeader(request.headers["x-anonymous-id"]);
    if (anonymousId === undefined || anonymousId === "invalid") {
      return invalidAnonymousIdResponse(reply, request.id);
    }

    const result = await options.dataLifecycleUseCase.exportEvents(anonymousId);
    return reply.code(200).send(
      eventExportResultSchema.parse({
        version: result.version,
        exported_at: result.exportedAt,
        events: result.events.map((event) => ({
          request_id: event.requestId,
          risk_level: event.riskLevel,
          signal_codes: event.signalCodes,
          route: event.route,
          safety_action: event.safetyAction,
          duration_ms: event.durationMs,
          app_version: event.appVersion,
          risk_policy_version: event.riskPolicyVersion,
          response_prompt_version: event.responsePromptVersion,
          model_provider: event.modelProvider,
          risk_model: event.riskModel,
          generation_model: event.generationModel,
          created_at: event.createdAt,
        })),
      }),
    );
  });

  app.delete("/api/v1/events", async (request, reply) => {
    const anonymousId = parseAnonymousIdHeader(request.headers["x-anonymous-id"]);
    if (anonymousId === undefined || anonymousId === "invalid") {
      return invalidAnonymousIdResponse(reply, request.id);
    }

    const receipt = await options.dataLifecycleUseCase.deleteEvents(anonymousId);
    return reply.code(200).send(
      deletionReceiptSchema.parse({
        version: "deletion-receipt-v1",
        receipt_id: receipt.receiptId,
        scope: receipt.scope,
        deleted_event_count: receipt.deletedEventCount,
        completed_at: receipt.completedAt,
      }),
    );
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

function parseAnonymousIdHeader(
  value: string | string[] | undefined,
): string | "invalid" | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return "invalid";
  }
  const parsed = anonymousIdSchema.safeParse(value);
  return parsed.success ? parsed.data : "invalid";
}

function invalidAnonymousIdResponse(reply: FastifyReply, requestId: string) {
  return reply.code(400).send({
    error: {
      code: "INVALID_ANONYMOUS_ID",
      message: "The x-anonymous-id header must be a valid UUID.",
    },
    request_id: requestId,
  });
}
