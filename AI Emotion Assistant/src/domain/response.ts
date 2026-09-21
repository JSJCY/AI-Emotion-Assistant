import type { RiskLevel, SignalCode } from "./risk.js";

export const ROUTES = [
  "NORMAL",
  "PRO_SUPPORT",
  "SAFETY_CHECK",
  "EMERGENCY_CN",
  "MINOR_BOUNDARY",
] as const;

export type ResponseRoute = (typeof ROUTES)[number];
export type ResponseStrategy = "listen" | "clarify" | "express" | "act" | "safety";
export type ArtifactType = "none" | "situation_card" | "expression_draft" | "action_card";
export type SafetyAction =
  | "NONE"
  | "SHOW_PRO_SUPPORT"
  | "ASK_IMMEDIATE_DANGER"
  | "SHOW_EMERGENCY_CN"
  | "SHOW_MINOR_BOUNDARY";

export interface ResponseAction {
  readonly code: "CALL_110" | "CALL_120" | "CONTACT_TRUSTED_PERSON" | "MOVE_TO_SAFETY";
  readonly label: string;
}

export interface ResponseArtifact {
  readonly type: ArtifactType;
  readonly content: {
    readonly title: string | null;
    readonly body: string | null;
    readonly steps: readonly string[];
  };
}

export interface RespondResult {
  readonly version: "response-v1";
  readonly request_id: string;
  readonly route: ResponseRoute;
  readonly risk_level: RiskLevel;
  readonly signal_codes: readonly SignalCode[];
  readonly strategy: ResponseStrategy;
  readonly acknowledgement: string;
  readonly known_facts: readonly string[];
  readonly unverified_inferences: readonly string[];
  readonly question: string | null;
  readonly artifact: ResponseArtifact;
  readonly safety_action: SafetyAction;
  readonly actions: readonly ResponseAction[];
}

export interface GeneratedContent {
  readonly strategy: Exclude<ResponseStrategy, "safety">;
  readonly acknowledgement: string;
  readonly known_facts: readonly string[];
  readonly unverified_inferences: readonly string[];
  readonly question: string | null;
  readonly artifact: ResponseArtifact;
  readonly safety_action: "NONE" | "SHOW_PRO_SUPPORT";
}
