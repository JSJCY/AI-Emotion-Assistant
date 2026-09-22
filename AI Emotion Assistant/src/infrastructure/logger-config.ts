export const LOG_REDACTION_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers.x-anonymous-id",
] as const;

export function buildLoggerOptions(level: string) {
  return {
    level,
    redact: {
      paths: [...LOG_REDACTION_PATHS],
      censor: "[REDACTED]",
    },
  };
}
