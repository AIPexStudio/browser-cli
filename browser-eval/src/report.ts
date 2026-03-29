import { writeFileSync } from "node:fs";
import type { TaskResult } from "./schemas.js";
import { computeStats, aggregateFailures } from "./results.js";

export function generateReport(
  results: TaskResult[],
  outputPath: string,
  codeChanges: string[] = [],
): void {
  const stats = computeStats(results);
  const failures = aggregateFailures(results);
  const iterations = new Set(results.map((r) => r.iteration || 1));

  const latestByTask = new Map<string, TaskResult>();
  for (const r of results) {
    const existing = latestByTask.get(r.task_id);
    if (!existing || (r.iteration || 0) > (existing.iteration || 0)) {
      latestByTask.set(r.task_id, r);
    }
  }

  const lines: string[] = [];

  lines.push("# Online-Mind2Web Benchmark Evaluation Report");
  lines.push("");
  lines.push("## AIPex/browser-cli Multi-Agent Auto-Research Results");
  lines.push("");
  lines.push(`**Date**: ${new Date().toISOString().split("T")[0]}`);
  lines.push(`**Agent Framework**: OpenAI Agents SDK (TypeScript)`);
  lines.push(`**Tasks Evaluated**: ${stats.total} unique tasks across ${iterations.size} iteration(s)`);
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push("## Results Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Total unique tasks evaluated | ${stats.total} |`);
  lines.push(`| Pass | ${stats.pass} (${stats.passRate}%) |`);
  lines.push(`| Fail | ${stats.fail} |`);
  lines.push(`| Error (external) | ${stats.error} |`);
  lines.push(`| **Effective pass rate** (excluding external errors) | **${stats.effectiveRate}%** (${stats.pass}/${stats.total - stats.error}) |`);
  lines.push("");

  if (iterations.size > 1) {
    lines.push("### Iteration History");
    lines.push("");
    lines.push("| Iteration | Tasks Run | Pass | Fail | Error |");
    lines.push("|-----------|-----------|------|------|-------|");
    for (const iter of Array.from(iterations).sort()) {
      const iterResults = results.filter((r) => (r.iteration || 1) === iter);
      const p = iterResults.filter((r) => r.status === "pass").length;
      const f = iterResults.filter((r) => r.status === "fail").length;
      const e = iterResults.filter((r) => r.status === "error").length;
      lines.push(`| ${iter} | ${iterResults.length} | ${p} | ${f} | ${e} |`);
    }
    lines.push("");
  }

  if (codeChanges.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Code Changes (Auto-Research)");
    lines.push("");
    for (const change of codeChanges) {
      lines.push(`- ${change}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Task Results");
  lines.push("");
  lines.push("| # | Task ID | Status | Steps | Description |");
  lines.push("|---|---------|--------|-------|-------------|");
  let idx = 1;
  for (const [, r] of latestByTask) {
    const statusIcon =
      r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : "ERROR";
    const taskDesc = r.task_description || "";
    const desc =
      taskDesc.length > 60
        ? taskDesc.slice(0, 57) + "..."
        : taskDesc;
    lines.push(
      `| ${idx} | ${r.task_id.slice(0, 8)} | ${statusIcon} | ${r.steps} | ${desc} |`,
    );
    idx++;
  }
  lines.push("");

  if (failures.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Failure Analysis");
    lines.push("");
    lines.push("| Category | Count | Examples |");
    lines.push("|----------|-------|---------|");
    for (const f of failures) {
      const example =
        f.examples.length > 0
          ? f.examples[0].slice(0, 80)
          : "—";
      lines.push(`| ${f.category} | ${f.count} | ${example} |`);
    }
    lines.push("");
  }

  writeFileSync(outputPath, lines.join("\n"), "utf-8");
}
