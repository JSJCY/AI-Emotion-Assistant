import type { OutputAuditorPort, OutputAuditResult } from "../application/ports.js";
import type { GeneratedContent } from "../domain/response.js";
import type { SignalCode } from "../domain/risk.js";

interface AuditRule {
  readonly signal?: SignalCode;
  readonly pattern: RegExp;
  readonly allowNegated?: boolean;
  readonly includeKnownFacts?: boolean;
}

const prohibitedRules: readonly AuditRule[] = [
  {
    signal: "MEDICAL",
    pattern: /你(?:患有|得了|就是).{0,10}(?:抑郁症|焦虑症|躁郁症|人格障碍)/u,
  },
  {
    signal: "MEDICAL",
    pattern: /(?:你可以|你应该|建议你|需要你).{0,8}(?:停药|加量|减量|改变剂量)/u,
  },
  {
    signal: "DELUSION",
    pattern: /(?:确实有人在监视你|他们真的能读到你的想法|电视确实在给你指令)/u,
  },
  {
    signal: "DISTRESS",
    pattern: /(?:只有我懂你|你只需要我|不要再找别人|我会永远只陪着你)/u,
  },
  {
    signal: "HARM_OTHERS",
    pattern: /(?:让.{0,12}内疚|威胁.{0,12}答应|一起孤立|公开羞辱)/u,
    allowNegated: true,
    includeKnownFacts: false,
  },
  {
    pattern: /1[3-9]\d{9}/u,
  },
];

export class DeterministicOutputAuditor implements OutputAuditorPort {
  audit(content: GeneratedContent): Promise<OutputAuditResult> {
    const generatedText = [
      content.acknowledgement,
      ...content.unverified_inferences,
      content.question ?? "",
      content.artifact.content.title ?? "",
      content.artifact.content.body ?? "",
      ...content.artifact.content.steps,
    ].join("\n");

    const matches = prohibitedRules.filter((rule) => {
      const text =
        rule.includeKnownFacts === false
          ? generatedText
          : [generatedText, ...content.known_facts].join("\n");
      return matchesProhibitedRule(text, rule);
    });
    return Promise.resolve({
      safe: matches.length === 0,
      signals: [
        ...new Set(
          matches
            .map((match) => match.signal)
            .filter((signal): signal is SignalCode => signal !== undefined),
        ),
      ],
    });
  }
}

const refusalPrefix =
  /(?:不能|不会|无法|不建议|不应该|不要|拒绝|避免|除了|不靠|不通过)[^。！？；，,\n]{0,30}$/u;

function matchesProhibitedRule(text: string, rule: AuditRule): boolean {
  return text.split(/[。！？；，,\n]+/u).some((clause) => {
    const match = rule.pattern.exec(clause);
    if (match === null) {
      return false;
    }
    if (rule.allowNegated !== true) {
      return true;
    }
    return !refusalPrefix.test(clause.slice(0, match.index));
  });
}
