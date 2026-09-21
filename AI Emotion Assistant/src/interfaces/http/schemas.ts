import { z } from "zod";

const conversationTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4_000),
});

export const respondRequestSchema = z.object({
  message: z.string().trim().min(1).max(4_000),
  context: z.array(conversationTurnSchema).max(12).default([]),
  preferred_strategy: z.enum(["listen", "clarify", "express", "act"]).optional(),
});

const actionSchema = z.object({
  code: z.enum(["CALL_110", "CALL_120", "CONTACT_TRUSTED_PERSON", "MOVE_TO_SAFETY"]),
  label: z.string().min(1).max(80),
});

export const respondResultSchema = z.object({
  version: z.literal("response-v1"),
  request_id: z.string().min(1),
  route: z.enum(["NORMAL", "PRO_SUPPORT", "SAFETY_CHECK", "EMERGENCY_CN", "MINOR_BOUNDARY"]),
  risk_level: z.enum(["L0", "L1", "L2", "L3"]),
  signal_codes: z.array(
    z.enum([
      "SELF_HARM",
      "HARM_OTHERS",
      "ABUSE",
      "MEDICAL",
      "DELUSION",
      "MINOR",
      "DISTRESS",
      "NONE",
    ]),
  ),
  strategy: z.enum(["listen", "clarify", "express", "act", "safety"]),
  acknowledgement: z.string().min(1),
  known_facts: z.array(z.string()),
  unverified_inferences: z.array(z.string()),
  question: z.string().nullable(),
  artifact: z.object({
    type: z.enum(["none", "situation_card", "expression_draft", "action_card"]),
    content: z.object({
      title: z.string().nullable(),
      body: z.string().nullable(),
      steps: z.array(z.string()),
    }),
  }),
  safety_action: z.enum([
    "NONE",
    "SHOW_PRO_SUPPORT",
    "ASK_IMMEDIATE_DANGER",
    "SHOW_EMERGENCY_CN",
    "SHOW_MINOR_BOUNDARY",
  ]),
  actions: z.array(actionSchema),
});
