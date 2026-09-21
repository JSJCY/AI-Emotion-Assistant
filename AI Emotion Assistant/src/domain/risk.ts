export const RISK_LEVELS = ["L0", "L1", "L2", "L3"] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

export const SIGNAL_CODES = [
  "SELF_HARM",
  "HARM_OTHERS",
  "ABUSE",
  "MEDICAL",
  "DELUSION",
  "MINOR",
  "DISTRESS",
  "NONE",
] as const;

export type SignalCode = (typeof SIGNAL_CODES)[number];

export type AssessmentSource = "local_rules" | "risk_model" | "output_audit";

export interface RiskAssessment {
  readonly level: RiskLevel;
  readonly signals: readonly SignalCode[];
  readonly immediateDanger: boolean;
  readonly source: AssessmentSource;
}

const RISK_PRIORITY: Readonly<Record<RiskLevel, number>> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
};

export function isAtLeast(level: RiskLevel, threshold: RiskLevel): boolean {
  return RISK_PRIORITY[level] >= RISK_PRIORITY[threshold];
}

export function highestAssessment(...assessments: readonly RiskAssessment[]): RiskAssessment {
  if (assessments.length === 0) {
    return {
      level: "L0",
      signals: ["NONE"],
      immediateDanger: false,
      source: "local_rules",
    };
  }

  const highest = assessments.reduce((current, candidate) =>
    RISK_PRIORITY[candidate.level] > RISK_PRIORITY[current.level] ? candidate : current,
  );

  const signals = [
    ...new Set(
      assessments.flatMap((assessment) => assessment.signals).filter((signal) => signal !== "NONE"),
    ),
  ];

  return {
    level: highest.level,
    signals: signals.length > 0 ? signals : ["NONE"],
    immediateDanger: assessments.some((assessment) => assessment.immediateDanger),
    source: highest.source,
  };
}
