import type { OutputAuditorPort, OutputAuditResult } from "../application/ports.js";
import type { GeneratedContent } from "../domain/response.js";
import type { SignalCode } from "../domain/risk.js";

interface AuditRule {
  readonly signal?: SignalCode;
  readonly pattern: RegExp;
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
  },
  {
    pattern: /1[3-9]\d{9}/u,
  },
];

export class DeterministicOutputAuditor implements OutputAuditorPort {
  audit(content: GeneratedContent): Promise<OutputAuditResult> {
    const text = [
      content.acknowledgement,
      ...content.known_facts,
      ...content.unverified_inferences,
      content.question ?? "",
      content.artifact.content.title ?? "",
      content.artifact.content.body ?? "",
      ...content.artifact.content.steps,
    ].join("\n");

    const matches = prohibitedRules.filter((rule) => rule.pattern.test(text));
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
