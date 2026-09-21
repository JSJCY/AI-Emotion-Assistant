import { ApplicationError } from "../application/errors.js";
import type {
  RespondCommand,
  ResponseGeneratorPort,
  RiskClassifierPort,
} from "../application/ports.js";
import type { RiskAssessment } from "../domain/risk.js";

export class DisabledRiskClassifier implements RiskClassifierPort {
  classify(_command: RespondCommand): Promise<RiskAssessment> {
    throw new ApplicationError(
      "SAFETY_CLASSIFIER_UNAVAILABLE",
      "The external safety classifier is not configured.",
      503,
    );
  }
}

export class DisabledResponseGenerator implements ResponseGeneratorPort {
  generate(_command: RespondCommand, _assessment: RiskAssessment): never {
    throw new ApplicationError(
      "GENERATOR_UNAVAILABLE",
      "The response generator is not configured.",
      503,
    );
  }
}
