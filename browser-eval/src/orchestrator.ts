import { readFileSync } from "node:fs";
import { Runner } from "@openai/agents";
import type { EvalConfig } from "./config.js";
import { ConfigurableModelProvider } from "./config.js";
import { createExecutorAgent } from "./agents/executor.js";
import { createJudgeAgent } from "./agents/judge.js";
import { createResearcherAgent } from "./agents/researcher.js";
import type { Task, TaskResult, ExecutorResult, JudgeVerdict } from "./schemas.js";
import type { EvalContext } from "./context.js";
import {
  readResults,
  appendResult,
  getLatestResultForTask,
  getMaxIteration,
  aggregateFailures,
  computeStats,
} from "./results.js";
import { generateReport } from "./report.js";

export interface OrchestratorOptions {
  count?: number;
  difficulty?: "easy" | "medium" | "hard";
  taskIds?: string[];
  retryFailed?: boolean;
  reportOnly?: boolean;
}

export class Orchestrator {
  private config: EvalConfig;
  private runner: Runner;
  private executorAgent: ReturnType<typeof createExecutorAgent>;
  private judgeAgent: ReturnType<typeof createJudgeAgent>;
  private researcherAgent: ReturnType<typeof createResearcherAgent>;
  private codeChanges: string[] = [];

  constructor(config: EvalConfig) {
    this.config = config;
    const modelProvider = new ConfigurableModelProvider(config);
    this.runner = new Runner({ modelProvider });
    this.executorAgent = createExecutorAgent();
    this.judgeAgent = createJudgeAgent();
    this.researcherAgent = createResearcherAgent();
  }

  async run(options: OrchestratorOptions): Promise<void> {
    if (options.reportOnly) {
      this.generateFinalReport();
      return;
    }

    const tasks = this.loadTasks(options);
    const existingResults = readResults(this.config.resultsPath);
    const currentIteration = getMaxIteration(existingResults) + 1;

    console.log(`\n=== Browser-Eval: Starting iteration ${currentIteration} ===`);
    console.log(`Tasks: ${tasks.length}, Model: ${this.config.llmModel}`);
    console.log(`Auto-research: ${this.config.autoResearch ? "enabled" : "disabled"}`);
    console.log("");

    const batchResults: TaskResult[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      console.log(
        `[${i + 1}/${tasks.length}] ${task.task_id.slice(0, 8)}: ${task.task_description.slice(0, 70)}...`,
      );

      try {
        const result = await this.runTask(task, currentIteration);
        batchResults.push(result);
        appendResult(this.config.resultsPath, result);

        const icon = result.status === "pass" ? "✓" : result.status === "fail" ? "✗" : "⚠";
        console.log(
          `  ${icon} ${result.status.toUpperCase()} (${result.steps} steps) ${result.failure_reason ? "- " + result.failure_reason.slice(0, 60) : ""}`,
        );
      } catch (err: any) {
        console.error(`  ERROR: ${err.message}`);
        const errorResult: TaskResult = {
          task_id: task.task_id,
          task_description: task.task_description,
          iteration: currentIteration,
          status: "error",
          steps: 0,
          failure_reason: `agent_error: ${err.message}`,
          failure_category: "timeout",
          actions: [],
          final_url: "",
          timestamp: new Date().toISOString(),
        };
        batchResults.push(errorResult);
        appendResult(this.config.resultsPath, errorResult);
      }
    }

    this.printBatchSummary(batchResults);

    if (this.config.autoResearch && batchResults.length > 0) {
      await this.autoResearchCycle(batchResults, currentIteration);
    }

    this.generateFinalReport();
  }

  private loadTasks(options: OrchestratorOptions): Task[] {
    const raw = readFileSync(this.config.tasksPath, "utf-8");
    let tasks: Task[] = JSON.parse(raw);

    if (options.retryFailed) {
      const existing = readResults(this.config.resultsPath);
      const failedIds = new Set<string>();
      const latestByTask = new Map<string, TaskResult>();
      for (const r of existing) {
        const prev = latestByTask.get(r.task_id);
        if (!prev || (r.iteration || 0) > (prev.iteration || 0)) {
          latestByTask.set(r.task_id, r);
        }
      }
      for (const [id, r] of latestByTask) {
        if (r.status !== "pass") failedIds.add(id);
      }
      tasks = tasks.filter((t) => failedIds.has(t.task_id));
      console.log(`Retrying ${tasks.length} previously failed tasks`);
    }

    if (options.taskIds && options.taskIds.length > 0) {
      const idSet = new Set(options.taskIds);
      tasks = tasks.filter((t) => idSet.has(t.task_id));
    }

    if (options.difficulty) {
      tasks = tasks.filter((t) => t.difficulty === options.difficulty);
    }

    if (options.count && options.count > 0) {
      tasks = tasks.slice(0, options.count);
    }

    return tasks;
  }

  private async runTask(task: Task, iteration: number): Promise<TaskResult> {
    const context: EvalContext = {
      config: this.config,
      currentTask: task,
      currentTabId: null,
      iteration,
    };

    const executorPrompt = `Complete this web task:\n\n"${task.task_description}"\n\nStart by navigating to the appropriate website. Use the browser tools to complete the task step by step.`;

    let executorOutput: ExecutorResult;
    try {
      const execResult = await this.runner.run(this.executorAgent, executorPrompt, {
        context,
        maxTurns: this.config.maxStepsPerTask,
      });
      executorOutput = execResult.finalOutput as unknown as ExecutorResult;
    } catch (err: any) {
      return {
        task_id: task.task_id,
        task_description: task.task_description,
        iteration,
        status: "error",
        steps: 0,
        failure_reason: `executor_error: ${err.message}`,
        failure_category: "timeout",
        actions: [],
        final_url: "",
        timestamp: new Date().toISOString(),
      };
    }

    const judgePrompt = `## Task Description
"${task.task_description}"

## Executor Action Trace
Actions taken: ${JSON.stringify(executorOutput.actions)}
Steps: ${executorOutput.steps}
Final URL: ${executorOutput.finalUrl}

## Final Page State
${executorOutput.finalPageSummary}

## Agent Self-Assessment
Completed: ${executorOutput.completed}

Judge whether this task was completed successfully.`;

    let verdict: JudgeVerdict;
    try {
      const judgeResult = await this.runner.run(this.judgeAgent, judgePrompt, {
        context,
      });
      verdict = judgeResult.finalOutput as unknown as JudgeVerdict;
    } catch (err: any) {
      verdict = {
        status: "error",
        failureReason: `judge_error: ${err.message}`,
        failureCategory: "timeout",
        confidence: 0,
        reasoning: "Judge agent failed to produce a verdict.",
      };
    }

    return {
      task_id: task.task_id,
      task_description: task.task_description,
      iteration,
      status: verdict.status,
      steps: executorOutput.steps,
      failure_reason: verdict.failureReason,
      failure_category: verdict.failureCategory,
      actions: executorOutput.actions,
      final_url: executorOutput.finalUrl,
      timestamp: new Date().toISOString(),
      confidence: verdict.confidence,
    };
  }

  private async autoResearchCycle(
    batchResults: TaskResult[],
    iteration: number,
  ): Promise<void> {
    const failures = aggregateFailures(batchResults);
    const addressable = failures.filter(
      (f) =>
        !["captcha_blocked", "blocked", "geo_restricted", "canvas_rendering", "requires_login"].includes(f.category),
    );

    if (addressable.length === 0) {
      console.log("\nNo addressable failures found -- skipping auto-research.");
      return;
    }

    const topFailure = addressable[0];
    if (topFailure.count < 2) {
      console.log(
        `\nTop failure category "${topFailure.category}" only has ${topFailure.count} task(s) -- skipping auto-research (need >= 2).`,
      );
      return;
    }

    console.log(
      `\n=== Auto-Research: Targeting "${topFailure.category}" (${topFailure.count} failures) ===`,
    );

    const context: EvalContext = {
      config: this.config,
      currentTask: null,
      currentTabId: null,
      iteration,
    };

    const researchPrompt = `## Failure Analysis

Top failure category: "${topFailure.category}" (${topFailure.count} tasks failed)

Example failures:
${topFailure.examples.map((e) => `- ${e}`).join("\n")}

All failure categories:
${failures.map((f) => `- ${f.category}: ${f.count} tasks`).join("\n")}

## Your task:

1. Explore the relevant source code to understand the root cause.
2. Apply a targeted fix that addresses this class of failures.
3. Build to verify the fix compiles.

Focus on the highest-impact fix. Make a big bet -- don't make tiny tweaks.`;

    try {
      const researchResult = await this.runner.run(
        this.researcherAgent,
        researchPrompt,
        { context, maxTurns: 30 },
      );
      const output = researchResult.finalOutput as any;

      if (output.buildSuccess && output.filesChanged.length > 0) {
        this.codeChanges.push(output.patchDescription);
        console.log(`  Fix applied: ${output.patchDescription}`);
        console.log(`  Files changed: ${output.filesChanged.join(", ")}`);
        console.log(`  Expected impact: ~${output.expectedImpact} additional passes`);

        console.log("\n=== Retrying failed tasks to verify fix ===");
        const retryTasks = topFailure.taskIds
          .slice(0, 5)
          .map((id) => {
            const raw = readFileSync(this.config.tasksPath, "utf-8");
            const all: Task[] = JSON.parse(raw);
            return all.find((t) => t.task_id === id);
          })
          .filter(Boolean) as Task[];

        const retryIteration = iteration + 1;
        for (const task of retryTasks) {
          const result = await this.runTask(task, retryIteration);
          appendResult(this.config.resultsPath, result);
          result.code_change = output.patchDescription;
          const icon = result.status === "pass" ? "✓" : "✗";
          console.log(
            `  ${icon} ${result.status.toUpperCase()}: ${task.task_description.slice(0, 60)}`,
          );
        }
      } else {
        console.log("  Research did not produce a viable fix.");
      }
    } catch (err: any) {
      console.error(`  Research failed: ${err.message}`);
    }
  }

  private printBatchSummary(results: TaskResult[]): void {
    const pass = results.filter((r) => r.status === "pass").length;
    const fail = results.filter((r) => r.status === "fail").length;
    const error = results.filter((r) => r.status === "error").length;

    console.log(
      `\n--- Batch Summary: ${pass} pass / ${fail} fail / ${error} error (${results.length} total) ---`,
    );

    if (fail + error > 0) {
      const failures = aggregateFailures(results);
      console.log("Failure categories:");
      for (const f of failures) {
        console.log(`  ${f.category}: ${f.count}`);
      }
    }
  }

  private generateFinalReport(): void {
    const allResults = readResults(this.config.resultsPath);
    if (allResults.length === 0) {
      console.log("No results to report.");
      return;
    }

    generateReport(allResults, this.config.reportPath, this.codeChanges);
    const stats = computeStats(allResults);
    console.log(
      `\nReport generated: ${this.config.reportPath}`,
    );
    console.log(
      `Overall: ${stats.pass}/${stats.total} pass (${stats.passRate}%), effective: ${stats.effectiveRate}%`,
    );
  }
}
