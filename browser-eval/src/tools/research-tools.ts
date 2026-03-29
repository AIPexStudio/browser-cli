import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tool } from "@openai/agents";
import { z } from "zod";
import type { EvalContext } from "../context.js";

function getWorkspaceRoot(runContext: any): string {
  const ctx: EvalContext | undefined = runContext?.context;
  return ctx?.config?.workspaceRoot || process.cwd();
}

export const readSourceFile = tool({
  name: "read_source_file",
  description:
    "Read the contents of a source file from the workspace. Use to inspect browser-cli or AIPex source code.",
  parameters: z.object({
    path: z
      .string()
      .describe(
        "Relative path from workspace root, e.g. 'browser-cli/src/lib/daemon-client.ts' or 'aipex/src/mcp-servers/smart-locator.ts'",
      ),
  }),
  async execute({ path }, runContext) {
    const root = getWorkspaceRoot(runContext);
    const fullPath = `${root}/${path}`;
    try {
      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      if (lines.length > 200) {
        return `File: ${path} (${lines.length} lines)\n\n${lines.slice(0, 200).join("\n")}\n\n... (truncated, ${lines.length - 200} more lines)`;
      }
      return `File: ${path} (${lines.length} lines)\n\n${content}`;
    } catch (err: any) {
      return `Error reading ${path}: ${err.message}`;
    }
  },
});

export const writePatch = tool({
  name: "write_patch",
  description:
    "Apply a targeted string replacement in a source file. The 'search' string must exactly match existing code. Use to fix bugs found during failure analysis.",
  parameters: z.object({
    path: z
      .string()
      .describe("Relative path from workspace root"),
    search: z
      .string()
      .describe("Exact string to find in the file (must be unique)"),
    replace: z
      .string()
      .describe("Replacement string"),
  }),
  async execute({ path, search, replace }, runContext) {
    const root = getWorkspaceRoot(runContext);
    const fullPath = `${root}/${path}`;
    try {
      const content = readFileSync(fullPath, "utf-8");
      const occurrences = content.split(search).length - 1;
      if (occurrences === 0) {
        return `Error: search string not found in ${path}`;
      }
      if (occurrences > 1) {
        return `Error: search string found ${occurrences} times in ${path} -- must be unique. Add more context.`;
      }
      const updated = content.replace(search, replace);
      writeFileSync(fullPath, updated, "utf-8");
      return `Patch applied to ${path}: replaced 1 occurrence (${search.length} chars -> ${replace.length} chars)`;
    } catch (err: any) {
      return `Error patching ${path}: ${err.message}`;
    }
  },
});

export const revertFile = tool({
  name: "revert_file",
  description:
    "Revert a file to its git HEAD version, undoing any patches. Use when a patch didn't improve results.",
  parameters: z.object({
    path: z
      .string()
      .describe("Relative path from workspace root"),
  }),
  async execute({ path }, runContext) {
    const root = getWorkspaceRoot(runContext);
    try {
      execSync(`git checkout HEAD -- "${path}"`, {
        cwd: root,
        encoding: "utf-8",
      });
      return `Reverted ${path} to HEAD`;
    } catch (err: any) {
      return `Error reverting ${path}: ${err.message}`;
    }
  },
});

export const runBuild = tool({
  name: "run_build",
  description:
    "Run 'npm run build' in the browser-cli directory to rebuild after code changes. Returns build output.",
  parameters: z.object({}),
  async execute(_input, runContext) {
    const root = getWorkspaceRoot(runContext);
    const cwd = `${root}/browser-cli`;
    try {
      const output = execSync("npm run build", {
        cwd,
        encoding: "utf-8",
        timeout: 30_000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return `Build succeeded:\n${output}`;
    } catch (err: any) {
      const stderr = err.stderr?.toString() || "";
      const stdout = err.stdout?.toString() || "";
      return `Build FAILED:\nstdout: ${stdout}\nstderr: ${stderr}`;
    }
  },
});

export const listSourceFiles = tool({
  name: "list_source_files",
  description:
    "List TypeScript source files in a directory. Use to explore the codebase structure.",
  parameters: z.object({
    directory: z
      .string()
      .describe(
        "Relative directory path, e.g. 'browser-cli/src' or 'aipex/src/mcp-servers'",
      ),
  }),
  async execute({ directory }, runContext) {
    const root = getWorkspaceRoot(runContext);
    const fullPath = `${root}/${directory}`;
    try {
      const output = execSync(
        `find "${fullPath}" -name "*.ts" -not -path "*/node_modules/*" | sort`,
        { encoding: "utf-8", timeout: 5_000 },
      );
      const files = output
        .trim()
        .split("\n")
        .map((f) => f.replace(root + "/", ""));
      return `Files in ${directory}:\n${files.join("\n")}`;
    } catch (err: any) {
      return `Error listing ${directory}: ${err.message}`;
    }
  },
});

export const allResearchTools = [
  readSourceFile,
  writePatch,
  revertFile,
  runBuild,
  listSourceFiles,
];
