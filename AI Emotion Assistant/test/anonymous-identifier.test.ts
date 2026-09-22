import { describe, expect, it } from "vitest";
import {
  RandomUuidGenerator,
  Sha256AnonymousIdentifierHasher,
} from "../src/infrastructure/anonymous-identifier.js";

describe("anonymous identifier infrastructure", () => {
  it("hashes identifiers deterministically without retaining the raw value", () => {
    const hasher = new Sha256AnonymousIdentifierHasher();
    const anonymousId = "550e8400-e29b-41d4-a716-446655440000";
    const first = hasher.hash(anonymousId);

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain(anonymousId);
    expect(hasher.hash(anonymousId)).toBe(first);
    expect(hasher.hash("550e8400-e29b-41d4-a716-446655440001")).not.toBe(first);
  });

  it("generates UUID deletion receipt identifiers", () => {
    const id = new RandomUuidGenerator().next();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
