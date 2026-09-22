import type {
  EventRepositoryPort,
  OutputAuditorPort,
  OutputAuditResult,
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

  isReady(): Promise<boolean> {
    return Promise.resolve(false);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}
