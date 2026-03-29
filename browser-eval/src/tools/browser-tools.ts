import { execSync } from "node:child_process";
import { tool } from "@openai/agents";
import { z } from "zod";

const EXEC_TIMEOUT_MS = 90_000;

function runBrowserCli(args: string): string {
  try {
    const result = execSync(`browser-cli ${args}`, {
      timeout: EXEC_TIMEOUT_MS,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch (err: any) {
    const stderr = err.stderr?.toString().trim() || "";
    const stdout = err.stdout?.toString().trim() || "";
    return JSON.stringify({
      ok: false,
      error: err.message,
      stderr,
      stdout,
    });
  }
}

function parseCliOutput(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return { ok: true, data: raw };
  }
}

export const navigate = tool({
  name: "navigate",
  description:
    "Open a new browser tab with the given URL. Returns the new tab's ID and info. Use this to navigate to a website.",
  parameters: z.object({
    url: z.string().describe("The URL to open in a new tab"),
  }),
  async execute({ url }) {
    const raw = runBrowserCli(`tab new "${url}"`);
    return raw;
  },
});

export const searchElements = tool({
  name: "search_elements",
  description: `Search for elements on the current page using glob/grep patterns against the DOM snapshot. Returns matching elements with UIDs for interaction.

GLOB SYNTAX:
- * matches any characters (e.g. button* finds all buttons)
- {a,b} matches alternatives (e.g. {button,input}* finds all buttons and inputs)
- Patterns are case-sensitive; use [Ll] for case-insensitive

STARTER QUERIES:
- Broad scan: {button,link,input,StaticText}*
- All interactive: {button,input,textarea,select,a}*
- Login/auth: *[Ll]ogin*, *[Ss]ign*
- Search boxes: *[Ss]earch*, {input,textarea}*

Returns elements with uid= attributes for use with click/fill tools.`,
  parameters: z.object({
    tabId: z.number().describe("The tab ID to search in"),
    query: z.string().describe("Glob/grep pattern to search for elements"),
  }),
  async execute({ tabId, query }) {
    const raw = runBrowserCli(`page search "${query}" --tab ${tabId}`);
    return raw;
  },
});

export const clickElement = tool({
  name: "click_element",
  description:
    "Click an element by its UID (obtained from search_elements). Use this to click buttons, links, and other interactive elements.",
  parameters: z.object({
    tabId: z.number().describe("The tab ID"),
    uid: z.string().describe("The element UID from search_elements results"),
  }),
  async execute({ tabId, uid }) {
    const raw = runBrowserCli(`interact click ${uid} --tab ${tabId}`);
    return raw;
  },
});

export const fillElement = tool({
  name: "fill_element",
  description:
    "Fill an input/textarea element with text by its UID. Use this to type into search boxes, form fields, etc.",
  parameters: z.object({
    tabId: z.number().describe("The tab ID"),
    uid: z.string().describe("The element UID from search_elements results"),
    value: z.string().describe("The text value to fill into the element"),
  }),
  async execute({ tabId, uid, value }) {
    const raw = runBrowserCli(
      `interact fill ${uid} "${value}" --tab ${tabId}`,
    );
    return raw;
  },
});

export const hoverElement = tool({
  name: "hover_element",
  description:
    "Hover over an element by its UID. Useful for revealing dropdown menus or tooltips.",
  parameters: z.object({
    tabId: z.number().describe("The tab ID"),
    uid: z.string().describe("The element UID from search_elements results"),
  }),
  async execute({ tabId, uid }) {
    const raw = runBrowserCli(`interact hover ${uid} --tab ${tabId}`);
    return raw;
  },
});

export const screenshot = tool({
  name: "screenshot",
  description:
    "Take a screenshot of a tab for visual verification. Use sparingly -- prefer search_elements for most interactions.",
  parameters: z.object({
    tabId: z.number().optional().describe("Tab ID (defaults to active tab)"),
  }),
  async execute({ tabId }) {
    const cmd = tabId
      ? `page screenshot-tab ${tabId}`
      : "page screenshot";
    const raw = runBrowserCli(cmd);
    return raw;
  },
});

export const keyboard = tool({
  name: "keyboard",
  description:
    "Send keyboard input. Use for pressing Enter, Escape, Tab, ArrowDown, Backspace, or key combinations like 'cmd+a'.",
  parameters: z.object({
    text: z
      .string()
      .describe(
        "Key(s) to press, space-separated. E.g. 'Enter', 'Escape', 'ArrowDown', 'cmd+a Backspace'",
      ),
  }),
  async execute({ text }) {
    const raw = runBrowserCli(
      `interact computer --action key --text "${text}"`,
    );
    return raw;
  },
});

export const tabList = tool({
  name: "tab_list",
  description: "List all open browser tabs with their IDs, titles, and URLs.",
  parameters: z.object({}),
  async execute() {
    const raw = runBrowserCli("tab list");
    return raw;
  },
});

export const tabClose = tool({
  name: "tab_close",
  description: "Close a specific browser tab by its ID.",
  parameters: z.object({
    tabId: z.number().describe("The ID of the tab to close"),
  }),
  async execute({ tabId }) {
    const raw = runBrowserCli(`tab close ${tabId}`);
    return raw;
  },
});

export const tabCurrent = tool({
  name: "tab_current",
  description: "Get the currently active tab's ID and info.",
  parameters: z.object({}),
  async execute() {
    const raw = runBrowserCli("tab current");
    return raw;
  },
});

export const getMetadata = tool({
  name: "get_metadata",
  description:
    "Get page metadata (title, URL, description) for a tab. Useful for verifying navigation.",
  parameters: z.object({
    tabId: z.number().optional().describe("Tab ID (defaults to active tab)"),
  }),
  async execute({ tabId }) {
    const cmd = tabId
      ? `page metadata --tab ${tabId}`
      : "page metadata";
    const raw = runBrowserCli(cmd);
    return raw;
  },
});

export const scrollPage = tool({
  name: "scroll_page",
  description:
    "Scroll the page up or down to reveal more content. Useful when elements are below the fold.",
  parameters: z.object({
    direction: z
      .enum(["up", "down"])
      .describe("Direction to scroll"),
    tabId: z.number().optional().describe("Tab ID (defaults to active tab)"),
  }),
  async execute({ direction, tabId }) {
    const coordinate = "[500,400]";
    let cmd = `interact computer --action scroll --scroll-direction ${direction} --coordinate "${coordinate}"`;
    if (tabId) cmd += ` --tab ${tabId}`;
    const raw = runBrowserCli(cmd);
    return raw;
  },
});

export const allBrowserTools = [
  navigate,
  searchElements,
  clickElement,
  fillElement,
  hoverElement,
  screenshot,
  keyboard,
  tabList,
  tabClose,
  tabCurrent,
  getMetadata,
  scrollPage,
];
