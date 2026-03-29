import OpenAI from "openai";
import {
  ModelProvider,
  OpenAIChatCompletionsModel,
  setTracingDisabled,
} from "@openai/agents";

export interface EvalConfig {
  llmHost: string;
  llmApiKey: string;
  llmModel: string;
  browserCliPath: string;
  tasksPath: string;
  resultsPath: string;
  reportPath: string;
  workspaceRoot: string;
  maxStepsPerTask: number;
  autoResearch: boolean;
  concurrency: number;
}

export function loadConfig(overrides: Partial<EvalConfig> = {}): EvalConfig {
  const llmApiKey = overrides.llmApiKey || process.env.LLM_API_KEY || "";
  if (!llmApiKey) {
    throw new Error(
      "LLM_API_KEY is required. Set it via env var or --api-key flag.",
    );
  }

  const selfDir = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
  const packageRoot = selfDir.replace(/\/src$/, "");
  const defaultWorkspaceRoot = packageRoot.replace(/\/browser-eval$/, "");
  const workspaceRoot = (
    overrides.workspaceRoot ||
    process.env.WORKSPACE_ROOT ||
    defaultWorkspaceRoot
  ).replace(/\/$/, "");

  return {
    llmHost:
      overrides.llmHost ||
      process.env.LLM_HOST ||
      "https://api.openai.com/v1",
    llmApiKey,
    llmModel: overrides.llmModel || process.env.LLM_MODEL || "gpt-4.1",
    browserCliPath:
      overrides.browserCliPath ||
      process.env.BROWSER_CLI_PATH ||
      "browser-cli",
    tasksPath:
      overrides.tasksPath || `${workspaceRoot}/browser-cli/eval/tasks.json`,
    resultsPath:
      overrides.resultsPath ||
      `${workspaceRoot}/browser-cli/eval/results.jsonl`,
    reportPath:
      overrides.reportPath || `${workspaceRoot}/browser-cli/eval/REPORT.md`,
    workspaceRoot,
    maxStepsPerTask: overrides.maxStepsPerTask || 20,
    autoResearch: overrides.autoResearch ?? true,
    concurrency: overrides.concurrency || 1,
  };
}

export class ConfigurableModelProvider implements ModelProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor(config: EvalConfig) {
    this.client = new OpenAI({
      baseURL: config.llmHost,
      apiKey: config.llmApiKey,
    });
    this.defaultModel = config.llmModel;
    setTracingDisabled(true);
  }

  getModel(modelName?: string) {
    return new OpenAIChatCompletionsModel(
      this.client as any,
      modelName || this.defaultModel,
    );
  }
}
