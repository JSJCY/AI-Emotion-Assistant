import { ApplicationError } from "./errors.js";
import type {
  AnonymousIdentifierHasherPort,
  ClockPort,
  DeletionReceipt,
  EventRepositoryPort,
  IdGeneratorPort,
  ResponseEvent,
} from "./ports.js";

export interface DataLifecycleUseCaseDependencies {
  readonly eventRepository: EventRepositoryPort;
  readonly identifierHasher: AnonymousIdentifierHasherPort;
  readonly idGenerator: IdGeneratorPort;
  readonly clock: ClockPort;
}

export interface ResponseEventExport {
  readonly version: "event-export-v1";
  readonly exportedAt: string;
  readonly events: readonly ExportedResponseEvent[];
}

export type ExportedResponseEvent = Omit<ResponseEvent, "anonymousIdHash">;

export class DataLifecycleUseCase {
  constructor(private readonly dependencies: DataLifecycleUseCaseDependencies) {}

  hashAnonymousId(anonymousId: string): string {
    return this.dependencies.identifierHasher.hash(anonymousId);
  }

  async exportEvents(anonymousId: string): Promise<ResponseEventExport> {
    await this.ensureEventStoreReady();
    const anonymousIdHash = this.hashAnonymousId(anonymousId);
    const storedEvents = await this.dependencies.eventRepository.listResponses(anonymousIdHash);
    return {
      version: "event-export-v1",
      exportedAt: this.dependencies.clock.now().toISOString(),
      events: storedEvents.map(toExportedResponseEvent),
    };
  }

  async deleteEvents(anonymousId: string): Promise<DeletionReceipt> {
    await this.ensureEventStoreReady();
    return this.dependencies.eventRepository.deleteResponses({
      receiptId: this.dependencies.idGenerator.next(),
      anonymousIdHash: this.hashAnonymousId(anonymousId),
      completedAt: this.dependencies.clock.now().toISOString(),
    });
  }

  private async ensureEventStoreReady(): Promise<void> {
    if (!(await this.dependencies.eventRepository.isReady())) {
      throw new ApplicationError("EVENT_STORE_UNAVAILABLE", "The event store is unavailable.", 503);
    }
  }
}

function toExportedResponseEvent(event: ResponseEvent): ExportedResponseEvent {
  return {
    requestId: event.requestId,
    riskLevel: event.riskLevel,
    signalCodes: event.signalCodes,
    route: event.route,
    safetyAction: event.safetyAction,
    durationMs: event.durationMs,
    appVersion: event.appVersion,
    riskPolicyVersion: event.riskPolicyVersion,
    responsePromptVersion: event.responsePromptVersion,
    modelProvider: event.modelProvider,
    riskModel: event.riskModel,
    generationModel: event.generationModel,
    createdAt: event.createdAt,
  };
}
