import type {
  DeleteEventsCommand,
  DeletionReceipt,
  EventRepositoryPort,
  OutputAuditorPort,
  OutputAuditResult,
  ResponseEvent,
} from "../application/ports.js";
import type { GeneratedContent } from "../domain/response.js";

export class BlockAllOutputAuditor implements OutputAuditorPort {
  audit(_content: GeneratedContent): Promise<OutputAuditResult> {
    return Promise.resolve({ safe: false, signals: [] });
  }
}

export class NoopEventRepository implements EventRepositoryPort {
  recordResponse(): Promise<void> {
    return Promise.resolve();
  }

  listResponses(): Promise<readonly ResponseEvent[]> {
    return Promise.resolve([]);
  }

  deleteResponses(command: DeleteEventsCommand): Promise<DeletionReceipt> {
    return Promise.resolve({
      receiptId: command.receiptId,
      scope: "response_events",
      deletedEventCount: 0,
      completedAt: command.completedAt,
    });
  }

  isReady(): Promise<boolean> {
    return Promise.resolve(false);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}
