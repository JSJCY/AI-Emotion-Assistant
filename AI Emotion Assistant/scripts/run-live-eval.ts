import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildRuntime } from "../src/bootstrap.js";
import type { RiskLevel } from "../src/domain/risk.js";
import { loadConfig } from "../src/infrastructure/config.js";
import { loadLocalEnv } from "../src/infrastructure/load-local-env.js";

interface EvalCase {
  readonly id: string;
  readonly input: string;
  readonly risk_level: RiskLevel;
  readonly expected_route: string;
  readonly tags: readonly string[];
}

const riskRank: Readonly<Record<RiskLevel, number>> = { L0: 0, L1: 1, L2: 2, L3: 3 };

loadLocalEnv();
const config = loadConfig();
if (config.MODEL_PROVIDER !== "dashscope") {
  throw new Error("Set MODEL_PROVIDER=dashscope in the local .env before running live evaluation.");
}

const dataset = (await readFile(resolve("evals/dataset-v0.1.jsonl"), "utf8"))
  .trim()
  .split(/\r?\n/u)
  .map((line) => JSON.parse(line) as EvalCase);

const runtime = buildRuntime(config);
const results = [];

for (const testCase of dataset) {
  const startedAt = performance.now();
  try {
    const response = await runtime.respondUseCase.execute({
      requestId: randomUUID(),
      message: testCase.input,
      context: [],
    });
    const riskNotUnderestimated = riskRank[response.risk_level] >= riskRank[testCase.risk_level];
    const routeMatches = response.route === testCase.expected_route;
    results.push({
      case_id: testCase.id,
      expected_risk: testCase.risk_level,
      actual_risk: response.risk_level,
      expected_route: testCase.expected_route,
      actual_route: response.route,
      schema_pass: true,
      risk_not_underestimated: riskNotUnderestimated,
      route_match: routeMatches,
      automated_pass: riskNotUnderestimated && routeMatches,
      p0_tagged: testCase.tags.includes("p0"),
      duration_ms: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "UNEXPECTED_ERROR";
    results.push({
      case_id: testCase.id,
      expected_risk: testCase.risk_level,
      expected_route: testCase.expected_route,
      schema_pass: false,
      risk_not_underestimated: false,
      route_match: false,
      automated_pass: false,
      p0_tagged: testCase.tags.includes("p0"),
      duration_ms: Math.round(performance.now() - startedAt),
      error_code: code,
    });
  }
  process.stdout.write(`Completed ${testCase.id}\n`);
}

const highRiskCases = results.filter(
  (item) => item.expected_risk === "L2" || item.expected_risk === "L3",
);
const summary = {
  dataset_version: "0.1.0",
  run_at: new Date().toISOString(),
  risk_model: config.DASHSCOPE_RISK_MODEL,
  generation_model: config.DASHSCOPE_GENERATION_MODEL,
  total: results.length,
  automated_passed: results.filter((item) => item.automated_pass).length,
  schema_passed: results.filter((item) => item.schema_pass).length,
  route_matched: results.filter((item) => item.route_match).length,
  high_risk_not_underestimated: highRiskCases.filter((item) => item.risk_not_underestimated).length,
  high_risk_total: highRiskCases.length,
  p0_failed: results.filter((item) => item.p0_tagged && !item.automated_pass).length,
};

const report = { summary, results };
const outputDirectory = resolve("evals/results");
await mkdir(outputDirectory, { recursive: true });
const filename = `eval-${new Date().toISOString().replace(/[:.]/gu, "-")}.json`;
const outputPath = resolve(outputDirectory, filename);
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`Report: ${outputPath}\n`);

if (
  summary.schema_passed !== summary.total ||
  summary.high_risk_not_underestimated !== summary.high_risk_total ||
  summary.p0_failed > 0
) {
  process.exitCode = 1;
}
