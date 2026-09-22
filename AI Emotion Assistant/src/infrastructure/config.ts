import { z } from "zod";

const emptyStringToUndefined = (value: unknown): unknown => (value === "" ? undefined : value);

const optionalNonEmptyString = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(1).optional(),
);

const configSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().min(1).default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    MODEL_PROVIDER: z.enum(["disabled", "dashscope"]).default("disabled"),
    DASHSCOPE_API_KEY: optionalNonEmptyString,
    DASHSCOPE_BASE_URL: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .url()
        .refine((value) => value.endsWith("/compatible-mode/v1"), {
          message: "DASHSCOPE_BASE_URL must end with /compatible-mode/v1",
        })
        .optional(),
    ),
    DASHSCOPE_RISK_MODEL: z.string().min(1).default("qwen3.7-plus-2026-05-26"),
    DASHSCOPE_GENERATION_MODEL: z.string().min(1).default("qwen3.7-plus-2026-05-26"),
    MODEL_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(12_000),
    MODEL_MAX_RETRIES: z.coerce.number().int().min(0).max(1).default(1),
    EVENT_STORE: z.enum(["disabled", "sqlite"]).default("disabled"),
    EVENT_DB_PATH: z.string().trim().min(1).default("./data/ai-emotion-assistant.db"),
  })
  .superRefine((config, context) => {
    if (config.MODEL_PROVIDER !== "dashscope") {
      return;
    }
    if (config.DASHSCOPE_API_KEY === undefined) {
      context.addIssue({
        code: "custom",
        path: ["DASHSCOPE_API_KEY"],
        message: "DASHSCOPE_API_KEY is required when MODEL_PROVIDER=dashscope",
      });
    }
    if (config.DASHSCOPE_BASE_URL === undefined) {
      context.addIssue({
        code: "custom",
        path: ["DASHSCOPE_BASE_URL"],
        message: "DASHSCOPE_BASE_URL is required when MODEL_PROVIDER=dashscope",
      });
    }
    if (config.DASHSCOPE_BASE_URL?.includes("YOUR_WORKSPACE_ID")) {
      context.addIssue({
        code: "custom",
        path: ["DASHSCOPE_BASE_URL"],
        message: "Replace YOUR_WORKSPACE_ID with the Beijing workspace ID",
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse(environment);
}
