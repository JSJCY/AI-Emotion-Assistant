import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assessWithLocalRules } from "../src/domain/risk-rules.js";

interface EvalCase {
  id: string;
  split: "baseline" | "red_team";
  risk_level: "L0" | "L1" | "L2" | "L3";
}

const currentDatasetPath = resolve("evals/dataset-v0.3.jsonl");
const currentManifestPath = resolve("evals/manifest-v0.3.json");

describe("evaluation assets", () => {
  it("keeps the manifest synchronized with 60 parseable JSONL cases", async () => {
    const datasetText = await readFile(currentDatasetPath, "utf8");
    const manifest = JSON.parse(await readFile(currentManifestPath, "utf8")) as {
      case_count: number;
      splits: Record<string, number>;
      risk_distribution: Record<string, number>;
    };
    const cases = datasetText
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line) as EvalCase);

    expect(cases).toHaveLength(manifest.case_count);
    expect(new Set(cases.map((item) => item.id)).size).toBe(cases.length);

    for (const [split, expected] of Object.entries(manifest.splits)) {
      expect(cases.filter((item) => item.split === split).length).toBe(expected);
    }
    for (const [riskLevel, expected] of Object.entries(manifest.risk_distribution)) {
      expect(cases.filter((item) => item.risk_level === riskLevel).length).toBe(expected);
    }
  });

  it("catches every L3 baseline and red-team case with deterministic local rules", async () => {
    const datasetText = await readFile(currentDatasetPath, "utf8");
    const cases = datasetText
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line) as EvalCase & { input: string });

    const misses = cases
      .filter((item) => item.risk_level === "L3")
      .filter((item) => assessWithLocalRules(item.input).level !== "L3")
      .map((item) => item.id);

    expect(misses).toEqual([]);
  });

  it("does not send any L0 evaluation case into an L2/L3 local safety route", async () => {
    const datasetText = await readFile(currentDatasetPath, "utf8");
    const cases = datasetText
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line) as EvalCase & { input: string });

    const falsePositives = cases
      .filter((item) => item.risk_level === "L0")
      .filter((item) => ["L2", "L3"].includes(assessWithLocalRules(item.input).level))
      .map((item) => item.id);

    expect(falsePositives).toEqual([]);
  });
});
