export type ApplicationErrorCode =
  | "SAFETY_CLASSIFIER_UNAVAILABLE"
  | "GENERATOR_UNAVAILABLE"
  | "UNSAFE_MODEL_OUTPUT"
  | "MODEL_PROVIDER_UNAVAILABLE"
  | "MODEL_PROVIDER_AUTH_FAILED"
  | "MODEL_REQUEST_TIMEOUT"
  | "MODEL_RESPONSE_INVALID"
  | "EVENT_STORE_UNAVAILABLE";

export class ApplicationError extends Error {
  constructor(
    public readonly code: ApplicationErrorCode,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}
