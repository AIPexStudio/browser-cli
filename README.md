# browser-cli

AI-friendly CLI to control the browser from the terminal.

---

## What is browser-cli?

`browser-cli` is a command-line tool that lets you control a Chrome browser directly from the terminal. It communicates with the [AIPex Chrome extension](https://aipex.ai) through a local WebSocket daemon, giving you full programmatic access to browser tabs, page elements, screenshots, downloads, and more.

It is designed for two primary audiences:

- **AI agents** (Cursor, Claude Code, Codex, etc.) that need to perform browser tasks as part of coding workflows
- **Developers and scripters** who want to automate browser interactions from shell scripts or CI pipelines

## Architecture

```
browser-cli ──WebSocket──▶ aipex-daemon ──WebSocket──▶ AIPex Chrome Extension ──▶ Browser APIs
```

The daemon acts as a relay between CLI clients and the AIPex extension:

```
browser-cli #1 ──WS /cli────┐
browser-cli #2 ──WS /cli────┤── aipex-daemon (:9223) ──WS /extension──▶ AIPex Extension
MCP bridge     ──WS /bridge──┘
```

- The daemon auto-spawns on first CLI invocation and self-terminates after 30 seconds of inactivity.
- A PID file at `~/.aipex-daemon.pid` tracks the running daemon.
- Health endpoint available at `http://localhost:9223/health`.

## Installation

```bash
npm install -g browser-cli
```

### Prerequisites

- **Node.js >= 18**
- **AIPex Chrome extension** installed ([Chrome Web Store](https://chromewebstore.google.com/detail/aipex-ai-browser-assistan/felgkdoipflhmfodmolmjkgfpcopobfh) or developer build)

## Quick Start

```bash
# 1. Install
npm install -g browser-cli

# 2. Connect the AIPex extension to the daemon
#    Open Chrome → AIPex extension → Options → WebSocket URL: ws://localhost:9223/extension → Connect

# 3. Start using it
browser-cli tab list
browser-cli tab new https://example.com
browser-cli page search "button*" --tab 123
```

## Setup: Connecting the Extension

After installing `browser-cli`, you need to connect the AIPex Chrome extension to the daemon:

1. Open Chrome and click the **AIPex** extension icon
2. Go to **Options** (or right-click the icon → "Extension options")
3. Find the **WebSocket Connection** section
4. Enter: `ws://localhost:9223`
5. Click **Connect**

Verify the connection:

```bash
browser-cli status
```

A successful response looks like:

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "extensionConnected": true,
    "bridgeClients": 0,
    "version": "3.1.0"
  }
}
```

## Command Reference

`browser-cli` organizes commands into groups. Run `browser-cli --help` for an overview, or `browser-cli <group> --help` for group-level help.

```
browser-cli <group> <command> [args] [--options]
```

### tab — Manage browser tabs

| Command | Description | Example |
|---------|-------------|---------|
| `list` | List all open tabs with IDs, titles, and URLs | `browser-cli tab list` |
| `current` | Get the currently active tab | `browser-cli tab current` |
| `switch <id>` | Switch to a specific tab by ID | `browser-cli tab switch 42` |
| `new <url>` | Open a new tab with the given URL | `browser-cli tab new https://google.com` |
| `close <id>` | Close a specific tab by ID | `browser-cli tab close 42` |
| `info <id>` | Get detailed info about a specific tab | `browser-cli tab info 42` |
| `organize` | Auto-group tabs by topic using AI | `browser-cli tab organize` |
| `ungroup` | Remove all tab groups in the current window | `browser-cli tab ungroup` |

### page — Inspect and interact with page content

| Command | Description | Example |
|---------|-------------|---------|
| `search <query> --tab <id>` | Search elements using glob/grep patterns | `browser-cli page search "button*" --tab 123` |
| `screenshot` | Capture screenshot of the visible tab | `browser-cli page screenshot` |
| `screenshot-tab <id>` | Capture screenshot of a specific tab | `browser-cli page screenshot-tab 123` |
| `metadata` | Get page metadata (title, description, etc.) | `browser-cli page metadata --tab 123` |
| `scroll-to <selector>` | Scroll to a DOM element by CSS selector | `browser-cli page scroll-to "#main"` |
| `highlight <selector>` | Highlight a DOM element with drop shadow | `browser-cli page highlight "button.submit"` |
| `highlight-text <selector> <text>` | Highlight specific words within text | `browser-cli page highlight-text "p" "important"` |

### interact — Click, fill, hover, and type on page elements

| Command | Description | Example |
|---------|-------------|---------|
| `click <uid> --tab <id>` | Click an element by UID | `browser-cli interact click btn-42 --tab 123` |
| `fill <uid> <value> --tab <id>` | Fill an input element by UID | `browser-cli interact fill input-5 "hello" --tab 123` |
| `hover <uid> --tab <id>` | Hover over an element by UID | `browser-cli interact hover menu-3 --tab 123` |
| `form --tab <id> --elements <json>` | Fill multiple form elements at once | `browser-cli interact form --tab 123 --elements '[...]'` |
| `editor <uid> --tab <id>` | Get content from a code editor or textarea | `browser-cli interact editor editor-1 --tab 123` |
| `upload --tab <id> --file-path <path>` | Upload a file to a file input element | `browser-cli interact upload --tab 123 --file-path /path/to/file.pdf` |
| `computer --action <action>` | Coordinate-based mouse/keyboard interaction | `browser-cli interact computer --action left_click --coordinate "[500,300]"` |

### download — Download content to local filesystem

| Command | Description | Example |
|---------|-------------|---------|
| `markdown --text <content>` | Download text content as a markdown file | `browser-cli download markdown --text "# Hello"` |
| `image --data <base64>` | Download an image from base64 data | `browser-cli download image --data "data:image/png;base64,..."` |
| `chat-images --messages <json>` | Download multiple images from chat messages | `browser-cli download chat-images --messages '[...]'` |

### intervention — Request human input during automation

| Command | Description | Example |
|---------|-------------|---------|
| `list` | List all available intervention types | `browser-cli intervention list` |
| `info <type>` | Get detailed info about an intervention type | `browser-cli intervention info voice-input` |
| `request <type>` | Request human intervention | `browser-cli intervention request voice-input --reason "Need confirmation"` |
| `cancel` | Cancel the currently active intervention | `browser-cli intervention cancel` |

### skill — Manage AIPex skills

| Command | Description | Example |
|---------|-------------|---------|
| `list` | List all available skills | `browser-cli skill list` |
| `load <name>` | Load the main content (SKILL.md) of a skill | `browser-cli skill load my-skill` |
| `info <name>` | Get detailed info about a skill | `browser-cli skill info my-skill` |
| `run <skill> <script>` | Execute a script belonging to a skill | `browser-cli skill run my-skill scripts/init.js` |
| `ref <skill> <path>` | Read a reference document from a skill | `browser-cli skill ref my-skill references/guide.md` |
| `asset <skill> <path>` | Get an asset file from a skill | `browser-cli skill asset my-skill assets/icon.png` |

### Standalone Commands

| Command | Description |
|---------|-------------|
| `status` | Check daemon and extension connection status |
| `update` | Update browser-cli to the latest version |

## Global Options

| Option | Description | Default |
|--------|-------------|---------|
| `--port <n>` | Daemon WebSocket port | `9223` |
| `--host <h>` | Daemon host address | `127.0.0.1` |
| `--help`, `-h` | Show help | |
| `--version`, `-v` | Show version | |

## Usage Examples

### List tabs and search for elements

```bash
# Get all tabs
browser-cli tab list

# Search for interactive elements on a tab
browser-cli page search "{button,input,textarea,select,a}*" --tab 123

# Click an element found via search
browser-cli interact click btn-42 --tab 123
```

### Fill a login form

```bash
# Find form inputs
browser-cli page search "{input,textbox}*" --tab 123

# Fill email and password
browser-cli interact fill input-email "user@example.com" --tab 123
browser-cli interact fill input-pass "mypassword" --tab 123

# Click the login button
browser-cli page search "*[Ll]ogin*" --tab 123
browser-cli interact click btn-login --tab 123
```

### Capture a screenshot

```bash
# Screenshot the active tab
browser-cli page screenshot

# Screenshot a specific tab with LLM analysis
browser-cli page screenshot-tab 123 --send-to-llm true
```

### Shell scripting / CI automation

```bash
#!/bin/bash
# Open a page and wait for it to load
browser-cli tab new https://example.com
sleep 2

# Get the current tab ID
TAB_INFO=$(browser-cli tab current)
TAB_ID=$(echo "$TAB_INFO" | jq '.data.id')

# Search and interact
browser-cli page search "link*" --tab "$TAB_ID"
browser-cli page screenshot
```

### Batch form filling

```bash
browser-cli interact form --tab 123 --elements '[
  {"uid": "input-name", "value": "John Doe"},
  {"uid": "input-email", "value": "john@example.com"},
  {"uid": "select-country", "value": "US"}
]'
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSER_CLI_WS_URL` | `ws://127.0.0.1:9223/cli` | Override the daemon WebSocket URL |
| `BROWSER_CLI_CONNECT_TIMEOUT` | `60000` | Max time (ms) to wait for daemon + extension connection |

## How It Works

1. **Daemon auto-spawn**: When you run any `browser-cli` command, the CLI checks if a daemon is already running. If not, it automatically forks a detached daemon process in the background.

2. **Retry with backoff**: If the daemon or extension is not yet ready, the CLI retries with exponential backoff (500ms initial, 5s max) until the connection is established or the timeout is reached.

3. **WebSocket relay**: The daemon listens on port 9223 with three endpoints:
   - `/extension` — AIPex Chrome extension connects here
   - `/bridge` — MCP bridge instances connect here
   - `/cli` — CLI tool calls connect here

4. **Tool call flow**: CLI commands are translated to JSON-RPC tool calls, sent to the daemon via WebSocket, relayed to the extension, executed in the browser, and results returned back through the same chain.

5. **Idle auto-shutdown**: The daemon self-terminates after 30 seconds with no active connections (no extension, no bridge clients), keeping your system clean.

6. **Version auto-check**: On each invocation, the CLI checks npm for newer versions in the background (cached for 24 hours). If an update is available, a notice is shown after the command completes.

## Using as an AI Agent Skill

`browser-cli` can be used as a skill in AI agent platforms. A ready-to-use [`SKILL.md`](SKILL.md) is included in this repository.

For AI agents that support skill installation (Cursor, Claude Code, Codex, etc.):

```bash
# The agent can invoke browser-cli commands directly via shell
browser-cli tab list
browser-cli page search "button*" --tab 123
browser-cli interact click btn-42 --tab 123
```

The recommended agent workflow:

1. `browser-cli tab list` — discover open tabs
2. `browser-cli page search "<pattern>" --tab <id>` — find elements on the page
3. `browser-cli interact click <uid> --tab <id>` — interact with found elements
4. `browser-cli page screenshot` — verify the result visually

See [`SKILL.md`](SKILL.md) for the full skill definition with trigger phrases and detailed usage instructions.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `Daemon not running` | Daemon hasn't started yet | Run any command — the daemon auto-spawns. Or run `browser-cli status` to check. |
| `Extension is not connected` | AIPex extension not connected to daemon | Open AIPex Options → set WebSocket URL to `ws://localhost:9223/extension` → Connect |
| Port 9223 already in use | Port conflict | Use `--port 9224` and update extension WebSocket URL accordingly |
| `Timed out after 60s` | Extension not connected within timeout | Check that the AIPex extension is installed and connected. Increase timeout with `BROWSER_CLI_CONNECT_TIMEOUT=120000` |
| `search_elements` returns 0 results | Page uses canvas or non-semantic HTML | Try different query patterns. Fall back to `page screenshot --send-to-llm true` + `interact computer` |
| Connection drops | Extension service worker sleep | AIPex uses keepalive pings. Reconnect from extension Options if needed |
| Commands work but results are empty | Tab ID is wrong | Run `browser-cli tab list` to get the correct tab IDs |
| `update` command fails | npm permissions | Try `sudo npm i -g browser-cli@latest` or use a Node version manager |

## License

[MIT](https://opensource.org/licenses/MIT)

---

<a id="zh-cn"></a>

# browser-cli (中文文档)

[![npm version](https://img.shields.io/npm/v/browser-cli.svg)](https://www.npmjs.com/package/browser-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

面向 AI 的命令行工具，通过 [AIPex](https://aipex.ai) Chrome 扩展在终端中控制浏览器。

---

## 什么是 browser-cli？

`browser-cli` 是一个命令行工具，让你能够直接在终端中控制 Chrome 浏览器。它通过本地 WebSocket 守护进程与 [AIPex Chrome 扩展](https://aipex.ai) 通信，提供对浏览器标签页、页面元素、截图、下载等功能的完整编程访问。

主要面向两类用户：

- **AI 智能体**（Cursor、Claude Code、Codex 等）—— 在编程工作流中执行浏览器任务
- **开发者和脚本编写者** —— 通过 Shell 脚本或 CI 管道自动化浏览器操作

## 架构

```
browser-cli ──WebSocket──▶ aipex-daemon ──WebSocket──▶ AIPex Chrome 扩展 ──▶ 浏览器 API
```

守护进程充当 CLI 客户端与 AIPex 扩展之间的中继：

```
browser-cli #1 ──WS /cli────┐
browser-cli #2 ──WS /cli────┤── aipex-daemon (:9223) ──WS /extension──▶ AIPex 扩展
MCP bridge     ──WS /bridge──┘
```

- 守护进程在首次 CLI 调用时自动启动，空闲 30 秒后自动退出。
- PID 文件位于 `~/.aipex-daemon.pid`，用于追踪运行中的守护进程。
- 健康检查端点：`http://localhost:9223/health`。

## 安装

```bash
npm install -g browser-cli
```

### 前置条件

- **Node.js >= 18**
- **AIPex Chrome 扩展**（[Chrome 应用商店](https://chromewebstore.google.com/detail/aipex-ai-browser-assistan/felgkdoipflhmfodmolmjkgfpcopobfh) 或开发者构建版）

## 快速开始

```bash
# 1. 安装
npm install -g browser-cli

# 2. 连接 AIPex 扩展到守护进程
#    打开 Chrome → AIPex 扩展 → 选项 → WebSocket URL: ws://localhost:9223/extension → 连接

# 3. 开始使用
browser-cli tab list
browser-cli tab new https://example.com
browser-cli page search "button*" --tab 123
```

## 配置：连接扩展

安装 `browser-cli` 后，需要将 AIPex Chrome 扩展连接到守护进程：

1. 打开 Chrome，点击 **AIPex** 扩展图标
2. 进入 **选项**（或右键点击图标 → "扩展选项"）
3. 找到 **WebSocket 连接** 区域
4. 输入：`ws://localhost:9223/extension`
5. 点击 **连接**

验证连接状态：

```bash
browser-cli status
```

成功响应如下：

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "extensionConnected": true,
    "bridgeClients": 0,
    "version": "3.1.0"
  }
}
```

## 命令参考

`browser-cli` 将命令组织为分组。运行 `browser-cli --help` 查看概览，或 `browser-cli <group> --help` 查看分组帮助。

```
browser-cli <group> <command> [args] [--options]
```

### tab — 管理浏览器标签页

| 命令 | 描述 | 示例 |
|------|------|------|
| `list` | 列出所有打开的标签页（含 ID、标题和 URL） | `browser-cli tab list` |
| `current` | 获取当前活动标签页 | `browser-cli tab current` |
| `switch <id>` | 通过 ID 切换到指定标签页 | `browser-cli tab switch 42` |
| `new <url>` | 打开一个新标签页 | `browser-cli tab new https://google.com` |
| `close <id>` | 关闭指定标签页 | `browser-cli tab close 42` |
| `info <id>` | 获取标签页详细信息 | `browser-cli tab info 42` |
| `organize` | 使用 AI 自动按主题分组标签页 | `browser-cli tab organize` |
| `ungroup` | 移除当前窗口中的所有标签页分组 | `browser-cli tab ungroup` |

### page — 检查和交互页面内容

| 命令 | 描述 | 示例 |
|------|------|------|
| `search <query> --tab <id>` | 使用 glob/grep 模式搜索元素 | `browser-cli page search "button*" --tab 123` |
| `screenshot` | 截取当前可见标签页的屏幕截图 | `browser-cli page screenshot` |
| `screenshot-tab <id>` | 截取指定标签页的屏幕截图 | `browser-cli page screenshot-tab 123` |
| `metadata` | 获取页面元数据（标题、描述等） | `browser-cli page metadata --tab 123` |
| `scroll-to <selector>` | 通过 CSS 选择器滚动到 DOM 元素 | `browser-cli page scroll-to "#main"` |
| `highlight <selector>` | 高亮 DOM 元素（阴影效果） | `browser-cli page highlight "button.submit"` |
| `highlight-text <selector> <text>` | 高亮文本中的特定词语 | `browser-cli page highlight-text "p" "important"` |

### interact — 点击、填写、悬停和输入页面元素

| 命令 | 描述 | 示例 |
|------|------|------|
| `click <uid> --tab <id>` | 通过 UID 点击元素 | `browser-cli interact click btn-42 --tab 123` |
| `fill <uid> <value> --tab <id>` | 通过 UID 填写输入元素 | `browser-cli interact fill input-5 "hello" --tab 123` |
| `hover <uid> --tab <id>` | 通过 UID 悬停在元素上 | `browser-cli interact hover menu-3 --tab 123` |
| `form --tab <id> --elements <json>` | 批量填写多个表单元素 | `browser-cli interact form --tab 123 --elements '[...]'` |
| `editor <uid> --tab <id>` | 获取代码编辑器或文本域的内容 | `browser-cli interact editor editor-1 --tab 123` |
| `upload --tab <id> --file-path <path>` | 上传文件到文件输入元素 | `browser-cli interact upload --tab 123 --file-path /path/to/file.pdf` |
| `computer --action <action>` | 基于坐标的鼠标/键盘交互 | `browser-cli interact computer --action left_click --coordinate "[500,300]"` |

### download — 下载内容到本地文件系统

| 命令 | 描述 | 示例 |
|------|------|------|
| `markdown --text <content>` | 将文本内容下载为 Markdown 文件 | `browser-cli download markdown --text "# Hello"` |
| `image --data <base64>` | 从 base64 数据下载图片 | `browser-cli download image --data "data:image/png;base64,..."` |
| `chat-images --messages <json>` | 从聊天消息中批量下载图片 | `browser-cli download chat-images --messages '[...]'` |

### intervention — 在自动化过程中请求人工输入

| 命令 | 描述 | 示例 |
|------|------|------|
| `list` | 列出所有可用的人工介入类型 | `browser-cli intervention list` |
| `info <type>` | 获取指定介入类型的详细信息 | `browser-cli intervention info voice-input` |
| `request <type>` | 请求人工介入 | `browser-cli intervention request voice-input --reason "需要确认"` |
| `cancel` | 取消当前活动的介入请求 | `browser-cli intervention cancel` |

### skill — 管理 AIPex 技能

| 命令 | 描述 | 示例 |
|------|------|------|
| `list` | 列出所有可用技能 | `browser-cli skill list` |
| `load <name>` | 加载技能的主要内容（SKILL.md） | `browser-cli skill load my-skill` |
| `info <name>` | 获取技能的详细信息 | `browser-cli skill info my-skill` |
| `run <skill> <script>` | 执行技能中的脚本 | `browser-cli skill run my-skill scripts/init.js` |
| `ref <skill> <path>` | 读取技能的参考文档 | `browser-cli skill ref my-skill references/guide.md` |
| `asset <skill> <path>` | 获取技能的资源文件 | `browser-cli skill asset my-skill assets/icon.png` |

### 独立命令

| 命令 | 描述 |
|------|------|
| `status` | 检查守护进程和扩展的连接状态 |
| `update` | 更新 browser-cli 到最新版本 |

## 全局选项

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `--port <n>` | 守护进程 WebSocket 端口 | `9223` |
| `--host <h>` | 守护进程主机地址 | `127.0.0.1` |
| `--help`, `-h` | 显示帮助 | |
| `--version`, `-v` | 显示版本 | |

## 使用示例

### 列出标签页并搜索元素

```bash
# 获取所有标签页
browser-cli tab list

# 搜索标签页上的可交互元素
browser-cli page search "{button,input,textarea,select,a}*" --tab 123

# 点击搜索到的元素
browser-cli interact click btn-42 --tab 123
```

### 填写登录表单

```bash
# 查找表单输入框
browser-cli page search "{input,textbox}*" --tab 123

# 填写邮箱和密码
browser-cli interact fill input-email "user@example.com" --tab 123
browser-cli interact fill input-pass "mypassword" --tab 123

# 点击登录按钮
browser-cli page search "*[Ll]ogin*" --tab 123
browser-cli interact click btn-login --tab 123
```

### 截图

```bash
# 截取活动标签页
browser-cli page screenshot

# 截取指定标签页并发送给 LLM 分析
browser-cli page screenshot-tab 123 --send-to-llm true
```

### Shell 脚本 / CI 自动化

```bash
#!/bin/bash
# 打开页面并等待加载
browser-cli tab new https://example.com
sleep 2

# 获取当前标签页 ID
TAB_INFO=$(browser-cli tab current)
TAB_ID=$(echo "$TAB_INFO" | jq '.data.id')

# 搜索并交互
browser-cli page search "link*" --tab "$TAB_ID"
browser-cli page screenshot
```

### 批量表单填写

```bash
browser-cli interact form --tab 123 --elements '[
  {"uid": "input-name", "value": "John Doe"},
  {"uid": "input-email", "value": "john@example.com"},
  {"uid": "select-country", "value": "US"}
]'
```

## 环境变量

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `BROWSER_CLI_WS_URL` | `ws://127.0.0.1:9223/cli` | 覆盖守护进程 WebSocket URL |
| `BROWSER_CLI_CONNECT_TIMEOUT` | `60000` | 等待守护进程 + 扩展连接的最大时间（毫秒） |

## 工作原理

1. **守护进程自动启动**：运行任何 `browser-cli` 命令时，CLI 会检查守护进程是否已在运行。如果没有，会自动在后台 fork 一个分离的守护进程。

2. **指数退避重试**：如果守护进程或扩展尚未就绪，CLI 会以指数退避策略重试（初始 500ms，最大 5s），直到连接建立或超时。

3. **WebSocket 中继**：守护进程在 9223 端口监听三个端点：
   - `/extension` — AIPex Chrome 扩展连接到此端点
   - `/bridge` — MCP bridge 实例连接到此端点
   - `/cli` — CLI 工具调用连接到此端点

4. **工具调用流程**：CLI 命令被转换为 JSON-RPC 工具调用，通过 WebSocket 发送到守护进程，中继到扩展，在浏览器中执行，结果通过同一链路返回。

5. **空闲自动关闭**：守护进程在没有活动连接 30 秒后自动退出（无扩展、无 bridge 客户端），保持系统清洁。

6. **版本自动检查**：每次调用时，CLI 在后台检查 npm 上是否有更新版本（缓存 24 小时）。如果有可用更新，会在命令完成后显示通知。

## 作为 AI 智能体技能使用

`browser-cli` 可以作为 AI 智能体平台中的技能使用。本仓库包含一个即用的 [`SKILL.md`](SKILL.md) 文件。

对于支持技能安装的 AI 智能体（Cursor、Claude Code、Codex 等）：

```bash
# 智能体可以直接通过 Shell 调用 browser-cli 命令
browser-cli tab list
browser-cli page search "button*" --tab 123
browser-cli interact click btn-42 --tab 123
```

推荐的智能体工作流：

1. `browser-cli tab list` — 发现打开的标签页
2. `browser-cli page search "<pattern>" --tab <id>` — 查找页面上的元素
3. `browser-cli interact click <uid> --tab <id>` — 与找到的元素交互
4. `browser-cli page screenshot` — 可视化验证结果

完整的技能定义请参阅 [`SKILL.md`](SKILL.md)。

## 故障排除

| 症状 | 可能原因 | 解决方法 |
|------|---------|---------|
| `Daemon not running` | 守护进程尚未启动 | 运行任意命令即可自动启动，或运行 `browser-cli status` 检查 |
| `Extension is not connected` | AIPex 扩展未连接到守护进程 | 打开 AIPex 选项 → 设置 WebSocket URL 为 `ws://localhost:9223/extension` → 连接 |
| 端口 9223 被占用 | 端口冲突 | 使用 `--port 9224` 并相应更新扩展的 WebSocket URL |
| `Timed out after 60s` | 扩展未在超时时间内连接 | 确认 AIPex 扩展已安装并连接。可通过 `BROWSER_CLI_CONNECT_TIMEOUT=120000` 增加超时时间 |
| `search_elements` 返回 0 结果 | 页面使用 canvas 或非语义化 HTML | 尝试不同的查询模式。回退到 `page screenshot --send-to-llm true` + `interact computer` |
| 连接断开 | 扩展 Service Worker 休眠 | AIPex 使用 keepalive ping。如需要，从扩展选项重新连接 |
| 命令执行成功但结果为空 | 标签页 ID 错误 | 运行 `browser-cli tab list` 获取正确的标签页 ID |
| `update` 命令失败 | npm 权限问题 | 尝试 `sudo npm i -g browser-cli@latest` 或使用 Node 版本管理器 |

## 许可证

[MIT](https://opensource.org/licenses/MIT)
