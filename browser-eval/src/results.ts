import { readFileSync, appendFileSync, existsSync } from "node:fs";
import type { TaskResult } from "./schemas.js";

export function readResults(path: string): TaskResult[] {
  if (!existsSync(path)) return [];
  const content = readFileSync(path, "utf-8").trim();
  if (!content) return [];
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as TaskResult);
}

export function appendResult(path: string, result: TaskResult): void {
  appendFileSync(path, JSON.stringify(result) + "\n", "utf-8");
}

export function getLatestResultForTask(
  results: TaskResult[],
  taskId: string,
): TaskResult | undefined {
  const taskResults = results.filter((r) => r.task_id === taskId);
  if (taskResults.length === 0) return undefined;
  return taskResults.reduce((latest, r) =>
    (r.iteration || 0) > (latest.iteration || 0) ? r : latest,
  );
}

export function getMaxIteration(results: TaskResult[]): number {
  if (results.length === 0) return 0;
  return Math.max(...results.map((r) => r.iteration || 1));
}

export interface FailureSummary {
  category: string;
  count: number;
  taskIds: string[];
  examples: string[];
}

export function aggregateFailures(results: TaskResult[]): FailureSummary[] {
  const latestByTask = new Map<string, TaskResult>();
  for (const r of results) {
    const existing = latestByTask.get(r.task_id);
    if (!existing || (r.iteration || 0) > (existing.iteration || 0)) {
      latestByTask.set(r.task_id, r);
    }
  }

  const byCat = new Map<string, TaskResult[]>();
  for (const r of latestByTask.values()) {
    if (r.status === "pass") continue;
    const cat = r.failure_category || "unknown";
    const list = byCat.get(cat) || [];
    list.push(r);
    byCat.set(cat, list);
  }

  return Array.from(byCat.entries())
    .map(([category, tasks]) => ({
      category,
      count: tasks.length,
      taskIds: tasks.map((t) => t.task_id),
      examples: tasks
        .slice(0, 3)
        .map(
          (t) => `[${t.task_id.slice(0, 8)}] ${t.task_description || "?"}: ${t.failure_reason}`,
        ),
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeStats(results: TaskResult[]) {
  const latestByTask = new Map<string, TaskResult>();
  for (const r of results) {
    const existing = latestByTask.get(r.task_id);
    if (!existing || (r.iteration || 0) > (existing.iteration || 0)) {
      latestByTask.set(r.task_id, r);
    }
  }

  const all = Array.from(latestByTask.values());
  const pass = all.filter((r) => r.status === "pass").length;
  const fail = all.filter((r) => r.status === "fail").length;
  const error = all.filter((r) => r.status === "error").length;
  const total = all.length;

  return {
    total,
    pass,
    fail,
    error,
    passRate: total > 0 ? ((pass / total) * 100).toFixed(1) : "0.0",
    effectiveRate:
      total - error > 0
        ? ((pass / (total - error)) * 100).toFixed(1)
        : "0.0",
  };
}
