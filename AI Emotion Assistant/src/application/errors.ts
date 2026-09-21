export type ApplicationErrorCode =
  | "SAFETY_CLASSIFIER_UNAVAILABLE"
  | "GENERATOR_UNAVAILABLE"
  | "UNSAFE_MODEL_OUTPUT";

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
