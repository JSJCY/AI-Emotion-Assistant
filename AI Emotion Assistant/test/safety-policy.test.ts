import { describe, expect, it } from "vitest";
import type { RiskAssessment } from "../src/domain/risk.js";
import { buildFixedSafetyResponse, routeForAssessment } from "../src/domain/safety-policy.js";

function assessment(overrides: Partial<RiskAssessment>): RiskAssessment {
  return {
    level: "L0",
    signals: ["NONE"],
    immediateDanger: false,
    source: "local_rules",
    ...overrides,
  };
}

describe("safety policy", () => {
  it("routes immediate danger to the mainland China emergency flow", () => {
    const risk = assessment({
      level: "L3",
      signals: ["SELF_HARM"],
      immediateDanger: true,
    });

    expect(routeForAssessment(risk)).toBe("EMERGENCY_CN");

    const response = buildFixedSafetyResponse("request-1", risk);
    expect(response.safety_action).toBe("SHOW_EMERGENCY_CN");
    expect(response.actions.map((action) => action.code)).toEqual([
      "CALL_110",
      "CALL_120",
      "CONTACT_TRUSTED_PERSON",
      "MOVE_TO_SAFETY",
    ]);
    expect(response.artifact.type).toBe("none");
  });

  it("uses the minor boundary flow without asking for more private content", () => {
    const risk = assessment({ level: "L1", signals: ["MINOR"] });
    const response = buildFixedSafetyResponse("request-2", risk);

    expect(response.route).toBe("MINOR_BOUNDARY");
    expect(response.safety_action).toBe("SHOW_MINOR_BOUNDARY");
    expect(response.acknowledgement).not.toContain("照片");
  });
});
