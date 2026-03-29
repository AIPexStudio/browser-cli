import type { EvalConfig } from "./config.js";
import type { Task } from "./schemas.js";

export interface EvalContext {
  config: EvalConfig;
  currentTask: Task | null;
  currentTabId: number | null;
  iteration: number;
}
