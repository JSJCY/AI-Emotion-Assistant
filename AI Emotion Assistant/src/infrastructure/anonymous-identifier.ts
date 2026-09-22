import { createHash, randomUUID } from "node:crypto";
import type { AnonymousIdentifierHasherPort, IdGeneratorPort } from "../application/ports.js";

export class Sha256AnonymousIdentifierHasher implements AnonymousIdentifierHasherPort {
  hash(anonymousId: string): string {
    return createHash("sha256").update(anonymousId, "utf8").digest("hex");
  }
}

export class RandomUuidGenerator implements IdGeneratorPort {
  next(): string {
    return randomUUID();
  }
}
