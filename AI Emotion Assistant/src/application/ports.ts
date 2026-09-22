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
  readonly anonymousIdHash?: string;
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
  readonly anonymousIdHash: string | null;
  readonly riskLevel: RiskLevel;
  readonly signalCodes: readonly SignalCode[];
  readonly route: ResponseRoute;
  readonly safetyAction: RespondResult["safety_action"];
  readonly durationMs: number;
  readonly appVersion: string;
  readonly riskPolicyVersion: string;
  readonly responsePromptVersion: string;
  readonly modelProvider: "disabled" | "dashscope";
  readonly riskModel: string | null;
  readonly generationModel: string | null;
  readonly createdAt: string;
}

export interface EventRepositoryPort {
  recordResponse(event: ResponseEvent): Promise<void>;
  listResponses(anonymousIdHash: string): Promise<readonly ResponseEvent[]>;
  deleteResponses(command: DeleteEventsCommand): Promise<DeletionReceipt>;
  isReady(): Promise<boolean>;
  close(): Promise<void>;
}

export interface DeleteEventsCommand {
  readonly receiptId: string;
  readonly anonymousIdHash: string;
  readonly completedAt: string;
}

export interface DeletionReceipt {
  readonly receiptId: string;
  readonly scope: "response_events";
  readonly deletedEventCount: number;
  readonly completedAt: string;
}

export interface AnonymousIdentifierHasherPort {
  hash(anonymousId: string): string;
}

export interface IdGeneratorPort {
  next(): string;
}

export interface ResponseEventMetadata {
  readonly appVersion: string;
  readonly riskPolicyVersion: string;
  readonly responsePromptVersion: string;
  readonly modelProvider: "disabled" | "dashscope";
  readonly riskModel: string | null;
  readonly generationModel: string | null;
}

export interface ClockPort {
  now(): Date;
  monotonicMs(): number;
}
