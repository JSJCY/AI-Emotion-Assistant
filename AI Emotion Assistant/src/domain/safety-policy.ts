import type { RespondResult, ResponseRoute } from "./response.js";
import type { RiskAssessment } from "./risk.js";
import { isAtLeast } from "./risk.js";

export function routeForAssessment(assessment: RiskAssessment): ResponseRoute {
  if (assessment.level === "L3" || assessment.immediateDanger) {
    return "EMERGENCY_CN";
  }
  if (assessment.signals.includes("MINOR")) {
    return "MINOR_BOUNDARY";
  }
  if (isAtLeast(assessment.level, "L2")) {
    return "SAFETY_CHECK";
  }
  if (assessment.level === "L1") {
    return "PRO_SUPPORT";
  }
  return "NORMAL";
}

export function requiresFixedSafetyResponse(assessment: RiskAssessment): boolean {
  const route = routeForAssessment(assessment);
  return route === "EMERGENCY_CN" || route === "SAFETY_CHECK" || route === "MINOR_BOUNDARY";
}

export function buildFixedSafetyResponse(
  requestId: string,
  assessment: RiskAssessment,
): RespondResult {
  const route = routeForAssessment(assessment);

  if (route === "EMERGENCY_CN") {
    return {
      version: "response-v1",
      request_id: requestId,
      route,
      risk_level: assessment.level,
      signal_codes: assessment.signals,
      strategy: "safety",
      acknowledgement:
        "你描述的情况可能有立即危险。请先不要独自处理，也不要接近可能造成伤害的人或物。",
      known_facts: [],
      unverified_inferences: [],
      question: "你现在能否先联系 110、120，或让一位可信任的人立即来到你身边？",
      artifact: { type: "none", content: {} },
      safety_action: "SHOW_EMERGENCY_CN",
      actions: [
        { code: "CALL_110", label: "拨打 110" },
        { code: "CALL_120", label: "拨打 120" },
        { code: "CONTACT_TRUSTED_PERSON", label: "联系可信任的人" },
        { code: "MOVE_TO_SAFETY", label: "前往有人且安全的地方" },
      ],
    };
  }

  if (route === "MINOR_BOUNDARY") {
    return {
      version: "response-v1",
      request_id: requestId,
      route,
      risk_level: assessment.level,
      signal_codes: assessment.signals,
      strategy: "safety",
      acknowledgement: "这类要求可能越过你的边界，也可能让你处于不安全的处境；这不是你的错。",
      known_facts: [],
      unverified_inferences: [],
      question: "你现在能否先停止单独接触，并把情况告诉一位可信任的成年人？",
      artifact: { type: "none", content: {} },
      safety_action: "SHOW_MINOR_BOUNDARY",
      actions: [
        { code: "CONTACT_TRUSTED_PERSON", label: "联系可信任的成年人" },
        { code: "MOVE_TO_SAFETY", label: "离开不安全的场景" },
      ],
    };
  }

  return {
    version: "response-v1",
    request_id: requestId,
    route: "SAFETY_CHECK",
    risk_level: assessment.level,
    signal_codes: assessment.signals,
    strategy: "safety",
    acknowledgement: "我会认真对待你刚才说的风险。现在最重要的是先确认你和身边人的安全。",
    known_facts: [],
    unverified_inferences: [],
    question: "你现在是否有立即伤害自己或他人的可能，或者已经有人受伤？",
    artifact: { type: "none", content: {} },
    safety_action: "ASK_IMMEDIATE_DANGER",
    actions: [
      { code: "CONTACT_TRUSTED_PERSON", label: "联系可信任的人" },
      { code: "MOVE_TO_SAFETY", label: "与危险源保持距离" },
    ],
  };
}
