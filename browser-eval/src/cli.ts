import { parseArgs } from "node:util";
import { loadConfig } from "./config.js";
import { Orchestrator, type OrchestratorOptions } from "./orchestrator.js";

function printHelp() {
  console.log(`
browser-eval — Multi-agent benchmark evaluation for browser-cli

USAGE:
  npx tsx src/cli.ts [options]

ENVIRONMENT VARIABLES:
  LLM_HOST       Base URL for the LLM API (default: https://api.openai.com/v1)
  LLM_API_KEY    API key for the LLM (required)
  LLM_MODEL      Model name (default: gpt-4.1)

OPTIONS:
  --count <n>         Run first N tasks (default: all)
  --difficulty <d>    Filter by difficulty: easy, medium, hard
  --tasks <ids>       Comma-separated task IDs to run
  --retry-failed      Only retry previously failed tasks
  --no-auto-research  Disable auto-research (execute + judge only)
  --report-only       Generate report from existing results
  --api-key <key>     LLM API key (alternative to env var)
  --host <url>        LLM API base URL (alternative to env var)
  --model <name>      LLM model name (alternative to env var)
  --max-steps <n>     Max steps per task (default: 20)
  --help              Show this help
`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      count: { type: "string" },
      difficulty: { type: "string" },
      tasks: { type: "string" },
      "retry-failed": { type: "boolean", default: false },
      "no-auto-research": { type: "boolean", default: false },
      "report-only": { type: "boolean", default: false },
      "api-key": { type: "string" },
      host: { type: "string" },
      model: { type: "string" },
      "max-steps": { type: "string" },
      help: { type: "boolean", default: false },
    },
    strict: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const config = loadConfig({
    llmApiKey: values["api-key"] as string | undefined,
    llmHost: values.host as string | undefined,
    llmModel: values.model as string | undefined,
    maxStepsPerTask: values["max-steps"]
      ? parseInt(values["max-steps"] as string, 10)
      : undefined,
    autoResearch: values["no-auto-research"] ? false : undefined,
  });

  const options: OrchestratorOptions = {
    count: values.count ? parseInt(values.count as string, 10) : undefined,
    difficulty: values.difficulty as "easy" | "medium" | "hard" | undefined,
    taskIds: values.tasks
      ? (values.tasks as string).split(",").map((s) => s.trim())
      : undefined,
    retryFailed: values["retry-failed"] as boolean,
    reportOnly: values["report-only"] as boolean,
  };

  console.log("browser-eval v1.0.0");
  console.log(`LLM: ${config.llmModel} @ ${config.llmHost}`);
  console.log(`Workspace: ${config.workspaceRoot}`);
  console.log(`Tasks: ${config.tasksPath}`);

  const orchestrator = new Orchestrator(config);
  await orchestrator.run(options);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
