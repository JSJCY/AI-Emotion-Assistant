import type { GeneratedContent, RespondResult, ResponseRoute } from "../domain/response.js";
import type { RiskAssessment, RiskLevel, SignalCode } from "../domain/risk.js";

export interface ConversationTurn {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface RespondCommand {
  readonly requestId: string;
  readonly message: string;
  readonly context: readonly ConversationTurn[];
  readonly preferredStrategy?: "listen" | "clarify" | "express" | "act";
}

export interface RiskClassifierPort {
  classify(command: RespondCommand): Promise<RiskAssessment>;
}

export interface ResponseGeneratorPort {
  generate(command: RespondCommand, assessment: RiskAssessment): Promise<GeneratedContent>;
}

export interface OutputAuditResult {
  readonly safe: boolean;
  readonly signals: readonly SignalCode[];
}

export interface OutputAuditorPort {
  audit(content: GeneratedContent): Promise<OutputAuditResult>;
}

export interface ResponseEvent {
  readonly requestId: string;
  readonly riskLevel: RiskLevel;
  readonly signalCodes: readonly SignalCode[];
  readonly route: ResponseRoute;
  readonly safetyAction: RespondResult["safety_action"];
  readonly durationMs: number;
  readonly createdAt: string;
}

export interface EventRepositoryPort {
  recordResponse(event: ResponseEvent): Promise<void>;
}

export interface ClockPort {
  now(): Date;
  monotonicMs(): number;
}
