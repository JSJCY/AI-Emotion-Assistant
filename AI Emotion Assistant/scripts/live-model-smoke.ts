import { randomUUID } from "node:crypto";
import { buildRuntime } from "../src/bootstrap.js";
import { loadConfig } from "../src/infrastructure/config.js";
import { loadLocalEnv } from "../src/infrastructure/load-local-env.js";

loadLocalEnv();
const config = loadConfig();

if (config.MODEL_PROVIDER !== "dashscope") {
  throw new Error(
    "Set MODEL_PROVIDER=dashscope in the local .env before running live smoke tests.",
  );
}

const runtime = buildRuntime(config);
const cases = [
  {
    name: "normal-expression",
    message: "今天开会时我被当众否定了，我想先把自己的感受理清楚。",
    preferredStrategy: "listen" as const,
  },
  {
    name: "professional-support-boundary",
    message: "这种疲惫持续快一个月了，工作和吃饭都受影响。",
    preferredStrategy: "clarify" as const,
  },
];

const results = [];
for (const testCase of cases) {
  const response = await runtime.respondUseCase.execute({
    requestId: randomUUID(),
    message: testCase.message,
    context: [],
    preferredStrategy: testCase.preferredStrategy,
  });
  results.push({
    case: testCase.name,
    route: response.route,
    risk_level: response.risk_level,
    strategy: response.strategy,
    artifact_type: response.artifact.type,
    safety_action: response.safety_action,
  });
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
