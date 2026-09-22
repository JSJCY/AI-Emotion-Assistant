import { z } from "zod";
import { ApplicationError } from "../../application/errors.js";
import type { RespondCommand, ResponseGeneratorPort } from "../../application/ports.js";
import type { GeneratedContent } from "../../domain/response.js";
import type { RiskAssessment } from "../../domain/risk.js";
import type { JsonCompletionClientPort } from "./json-completion-client.js";

const generatedContentSchema = z.object({
  strategy: z.enum(["listen", "clarify", "express", "act"]),
  acknowledgement: z.string().min(1).max(500),
  known_facts: z.array(z.string().min(1).max(300)).max(8),
  unverified_inferences: z.array(z.string().min(1).max(300)).max(8),
  question: z.string().min(1).max(300).nullable(),
  artifact: z.object({
    type: z.enum(["none", "situation_card", "expression_draft", "action_card"]),
    content: z.object({
      title: z.string().max(100).nullable(),
      body: z.string().max(1_200).nullable(),
      steps: z.array(z.string().min(1).max(300)).max(6),
    }),
  }),
  safety_action: z.enum(["NONE", "SHOW_PRO_SUPPORT"]),
});

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    strategy: { type: "string", enum: ["listen", "clarify", "express", "act"] },
    acknowledgement: { type: "string" },
    known_facts: { type: "array", items: { type: "string" }, maxItems: 8 },
    unverified_inferences: { type: "array", items: { type: "string" }, maxItems: 8 },
    question: nullableString,
    artifact: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          type: "string",
          enum: ["none", "situation_card", "expression_draft", "action_card"],
        },
        content: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: nullableString,
            body: nullableString,
            steps: { type: "array", items: { type: "string" }, maxItems: 6 },
          },
          required: ["title", "body", "steps"],
        },
      },
      required: ["type", "content"],
    },
    safety_action: { type: "string", enum: ["NONE", "SHOW_PRO_SUPPORT"] },
  },
  required: [
    "strategy",
    "acknowledgement",
    "known_facts",
    "unverified_inferences",
    "question",
    "artifact",
    "safety_action",
  ],
} as const;

const systemPrompt = `你是“AI 情绪表达与行动支持助手”，只处理非医疗级日常情绪支持。
目标是帮助用户表达、澄清或形成一个小行动，不做诊断、治疗、处方建议、妄想确认、操控、冒充或排他依赖。
严格区分用户明确说出的事实与未经验证的推测。不要承诺结果，不要声称替代现实关系或专业支持。
拒绝操控、羞辱、孤立或隐私扩张请求时，不要逐字复述其中的不当措辞，统一用“这种做法”或“这个请求”中性指代，再提供尊重边界的替代方案。
当风险等级为 L1 时，可以温和建议现实支持或合格专业人员，并设置 SHOW_PRO_SUPPORT；不要生成紧急号码或紧急流程。
遵循 preferred_strategy；未指定时选择最贴合当下需要的一种主策略。一次最多提出一个关键问题。`;

export const RESPONSE_PROMPT_VERSION = "response-prompt-v0.1";

export class DashscopeResponseGenerator implements ResponseGeneratorPort {
  constructor(
    private readonly client: JsonCompletionClientPort,
    private readonly model: string,
  ) {}

  async generate(command: RespondCommand, assessment: RiskAssessment): Promise<GeneratedContent> {
    const raw = await this.client.completeJson({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            risk_level: assessment.level,
            signal_codes: assessment.signals,
            preferred_strategy: command.preferredStrategy ?? null,
            current_message: command.message,
            recent_context: command.context.slice(-6),
          }),
        },
      ],
      responseSchema: { name: "emotion_support_response_v1", schema: responseJsonSchema },
      temperature: 0,
      maxCompletionTokens: 700,
    });

    const parsed = generatedContentSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApplicationError(
        "MODEL_RESPONSE_INVALID",
        "The response generator returned content that did not match the required schema.",
        502,
      );
    }
    return parsed.data;
  }
}
