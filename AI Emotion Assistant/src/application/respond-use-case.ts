import type { RespondResult } from "../domain/response.js";
import { highestAssessment } from "../domain/risk.js";
import { assessWithLocalRules } from "../domain/risk-rules.js";
import {
  buildFixedSafetyResponse,
  requiresFixedSafetyResponse,
  routeForAssessment,
} from "../domain/safety-policy.js";
import { ApplicationError } from "./errors.js";
import type {
  ClockPort,
  EventRepositoryPort,
  OutputAuditorPort,
  RespondCommand,
  ResponseEventMetadata,
  ResponseGeneratorPort,
  RiskClassifierPort,
} from "./ports.js";

export interface RespondUseCaseDependencies {
  readonly riskClassifier: RiskClassifierPort;
  readonly responseGenerator: ResponseGeneratorPort;
  readonly outputAuditor: OutputAuditorPort;
  readonly eventRepository: EventRepositoryPort;
  readonly eventMetadata: ResponseEventMetadata;
  readonly clock: ClockPort;
}

export class RespondUseCase {
  constructor(private readonly dependencies: RespondUseCaseDependencies) {}

  async execute(command: RespondCommand): Promise<RespondResult> {
    const startedAt = this.dependencies.clock.monotonicMs();
    const localAssessment = assessWithLocalRules(command.message);

    if (requiresFixedSafetyResponse(localAssessment)) {
      const response = buildFixedSafetyResponse(command.requestId, localAssessment);
      await this.recordEvent(command, response, startedAt);
      return response;
    }

    const modelAssessment = await this.dependencies.riskClassifier.classify(command);
    const effectiveAssessment = highestAssessment(localAssessment, modelAssessment);

    if (requiresFixedSafetyResponse(effectiveAssessment)) {
      const response = buildFixedSafetyResponse(command.requestId, effectiveAssessment);
      await this.recordEvent(command, response, startedAt);
      return response;
    }

    const generated = await this.dependencies.responseGenerator.generate(
      command,
      effectiveAssessment,
    );
    const audit = await this.dependencies.outputAuditor.audit(generated);

    if (!audit.safe) {
      throw new ApplicationError(
        "UNSAFE_MODEL_OUTPUT",
        "The generated response did not pass the output safety audit.",
        503,
      );
    }

    const response: RespondResult = {
      version: "response-v1",
      request_id: command.requestId,
      route: routeForAssessment(effectiveAssessment),
      risk_level: effectiveAssessment.level,
      signal_codes: effectiveAssessment.signals,
      strategy: generated.strategy,
      acknowledgement: generated.acknowledgement,
      known_facts: generated.known_facts,
      unverified_inferences: generated.unverified_inferences,
      question: generated.question,
      artifact: generated.artifact,
      safety_action: generated.safety_action,
      actions: [],
    };

    await this.recordEvent(command, response, startedAt);
    return response;
  }

  private async recordEvent(
    command: RespondCommand,
    response: RespondResult,
    startedAt: number,
  ): Promise<void> {
    await this.dependencies.eventRepository.recordResponse({
      requestId: response.request_id,
      anonymousIdHash: command.anonymousIdHash ?? null,
      riskLevel: response.risk_level,
      signalCodes: response.signal_codes,
      route: response.route,
      safetyAction: response.safety_action,
      durationMs: Math.max(0, this.dependencies.clock.monotonicMs() - startedAt),
      ...this.dependencies.eventMetadata,
      createdAt: this.dependencies.clock.now().toISOString(),
    });
  }
}
