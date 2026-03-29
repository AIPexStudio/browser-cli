import { z } from "zod";

export const ExecutorResult = z.object({
  actions: z
    .array(z.string())
    .describe("Chronological list of actions taken, e.g. 'tab new https://...'"),
  steps: z.number().describe("Total number of interaction steps performed"),
  finalUrl: z.string().describe("The URL of the page after task completion"),
  finalPageSummary: z
    .string()
    .describe(
      "Brief summary of what is visible on the final page (key content, elements, state)",
    ),
  completed: z
    .boolean()
    .describe("Whether the agent believes it completed the task goal"),
});
export type ExecutorResult = z.infer<typeof ExecutorResult>;

export const FailureCategory = z.enum([
  "element_not_found",
  "click_failed",
  "navigation_error",
  "captcha_blocked",
  "blocked",
  "timeout",
  "snapshot_empty",
  "complex_form",
  "page_not_found",
  "geo_restricted",
  "canvas_rendering",
  "requires_login",
  "ambiguous_query",
  "tab_open_failed",
  "none",
]);
export type FailureCategory = z.infer<typeof FailureCategory>;

export const JudgeVerdict = z.object({
  status: z
    .enum(["pass", "fail", "error"])
    .describe("Overall task completion status"),
  failureReason: z
    .string()
    .nullable()
    .describe("Detailed explanation of why the task failed, or null if passed"),
  failureCategory: FailureCategory.describe(
    "Categorized failure type for aggregation. Use 'none' for pass.",
  ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in this verdict (0 = uncertain, 1 = certain)"),
  reasoning: z
    .string()
    .describe("Step-by-step reasoning for the verdict decision"),
});
export type JudgeVerdict = z.infer<typeof JudgeVerdict>;

export const ResearchResult = z.object({
  hypothesis: z
    .string()
    .describe(
      "What root cause is being addressed and why this fix should work",
    ),
  filesChanged: z
    .array(z.string())
    .describe("List of file paths that were modified"),
  patchDescription: z
    .string()
    .describe("Human-readable summary of the code changes"),
  expectedImpact: z
    .number()
    .describe("Estimated number of additional tasks that would pass"),
  buildSuccess: z
    .boolean()
    .describe("Whether the build succeeded after applying patches"),
});
export type ResearchResult = z.infer<typeof ResearchResult>;

export interface Task {
  task_id: string;
  task_description: string;
  difficulty: "easy" | "medium" | "hard";
  website?: string;
}

export interface TaskResult {
  task_id: string;
  task_description: string;
  iteration: number;
  status: "pass" | "fail" | "error";
  steps: number;
  failure_reason: string | null;
  failure_category: string;
  actions: string[];
  final_url: string;
  timestamp: string;
  code_change?: string | null;
  confidence?: number;
}
