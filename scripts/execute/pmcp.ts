#!/usr/bin/env tsx
import {
  existsSync,
  readFileSync,
  writeFileSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import * as readline from "node:readline";

// Types
export interface RawMcpServer {
  type?: "local" | "remote";
  command?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;
}

export interface McpCatalogMeta {
  description: string;
  category: "browser" | "docs" | "dev" | "utility" | "ai";
  ramImpact: "low" | "medium" | "high";
  tags: string[];
}

export const MCP_CATALOG: Record<string, McpCatalogMeta> = {
  obscura: {
    description: "Lightweight Rust headless browser, 85ms startup, low RAM",
    category: "browser",
    ramImpact: "low",
    tags: ["scraping", "automation", "fast"],
  },
  camoufox: {
    description: "C++ Firefox anti-detect bypass Cloudflare, Akamai, Datadome",
    category: "browser",
    ramImpact: "high",
    tags: ["stealth", "turnstile", "fingerprint"],
  },
  context7: {
    description: "Real-time official documentation lookup",
    category: "docs",
    ramImpact: "low",
    tags: ["documentation", "upstash"],
  },
  deepwiki: {
    description: "DeepWiki API encyclopedia knowledge queries",
    category: "docs",
    ramImpact: "low",
    tags: ["wiki", "knowledge"],
  },
  "rust-anything": {
    description: "Analyze, bridge, and port code to Rust",
    category: "dev",
    ramImpact: "medium",
    tags: ["rust", "transpile"],
  },
  anki: {
    description: "AnkiConnect flashcard synchronization",
    category: "utility",
    ramImpact: "low",
    tags: ["anki", "flashcard"],
  },
  github: {
    description: "GitHub API integration (repos, issues, PRs)",
    category: "dev",
    ramImpact: "low",
    tags: ["git", "github"],
  },
  playwright: {
    description: "Playwright browser automation (Chromium)",
    category: "browser",
    ramImpact: "high",
    tags: ["browser", "testing"],
  },
  "playwright-headless": {
    description: "Playwright headless browser automation",
    category: "browser",
    ramImpact: "high",
    tags: ["browser", "headless"],
  },
  "firefox-devtools": {
    description: "Firefox DevTools automation",
    category: "browser",
    ramImpact: "high",
    tags: ["firefox", "devtools"],
  },
  gns3: {
    description: "GNS3 network simulation management",
    category: "utility",
    ramImpact: "medium",
    tags: ["network", "gns3"],
  },
  notebooklm: {
    description: "Google NotebookLM integration",
    category: "ai",
    ramImpact: "low",
    tags: ["google", "notes"],
  },
  "colab-mcp": {
    description: "Google Colab integration",
    category: "ai",
    ramImpact: "low",
    tags: ["colab", "jupyter"],
  },
  apify: {
    description: "Apify cloud actors and web scraping",
    category: "dev",
    ramImpact: "low",
    tags: ["scraping", "actors"],
  },
  cloudflare: {
    description: "Cloudflare API and Workers management",
    category: "dev",
    ramImpact: "low",
    tags: ["cloudflare", "workers"],
  },
  figwright: {
    description: "Figma design integration for AI agents",
    category: "dev",
    ramImpact: "low",
    tags: ["figma", "design"],
  },
  tavily: {
    description: "Tavily AI search engine",
    category: "ai",
    ramImpact: "low",
    tags: ["search", "web"],
  },
};

export const PRESETS: Record<string, string[]> = {
  web: ["obscura", "camoufox"],
  browser: ["obscura", "camoufox"],
  docs: ["context7", "deepwiki"],
  minimal: ["context7", "deepwiki"],
  rust: ["rust-anything"],
  study: ["anki"],
  all: Object.keys(MCP_CATALOG),
  none: [],
};

// Paths
const GLOBAL_OPENCODE_CONFIG = join(homedir(), ".config/opencode/config.json");

export function getAvailableServers(): Record<string, RawMcpServer> {
  const result: Record<string, RawMcpServer> = {};

  if (existsSync(GLOBAL_OPENCODE_CONFIG)) {
    try {
      const data = JSON.parse(readFileSync(GLOBAL_OPENCODE_CONFIG, "utf-8"));
      if (data.mcp && typeof data.mcp === "object") {
        for (const [k, v] of Object.entries(data.mcp)) {
          result[k] = v as RawMcpServer;
        }
      }
    } catch {
      // ignore
    }
  }

  // Fallback to catalog defaults if config is empty
  for (const k of Object.keys(MCP_CATALOG)) {
    if (!result[k]) {
      result[k] = { type: "local", command: [k], enabled: false };
    }
  }

  return result;
}

export function getGlobalActiveServers(): Set<string> {
  const available = getAvailableServers();
  const globalActive = new Set<string>();
  for (const [k, v] of Object.entries(available)) {
    if (v.enabled === true) {
      globalActive.add(k);
    }
  }
  return globalActive;
}

export type TargetAgent = "opencode" | "claude" | "antigravity";

export interface ProjectConfigs {
  opencodeFile: string;
  claudeFile: string;
  antigravityFile: string;
}

export function getProjectPaths(cwd = process.cwd()): ProjectConfigs {
  return {
    opencodeFile: join(cwd, "opencode.json"),
    claudeFile: join(cwd, ".mcp.json"),
    antigravityFile: join(cwd, ".gemini/mcp_config.json"),
  };
}

export function getActiveLocalServers(cwd = process.cwd()): string[] {
  const paths = getProjectPaths(cwd);
  const active = new Set<string>();

  // Check opencode.json
  if (existsSync(paths.opencodeFile)) {
    try {
      const json = JSON.parse(readFileSync(paths.opencodeFile, "utf-8"));
      if (json.mcp && typeof json.mcp === "object") {
        for (const [k, v] of Object.entries(json.mcp)) {
          if ((v as any).enabled !== false) active.add(k);
        }
      }
    } catch {}
  }

  // Check .mcp.json (Claude)
  if (existsSync(paths.claudeFile)) {
    try {
      const json = JSON.parse(readFileSync(paths.claudeFile, "utf-8"));
      if (json.mcpServers && typeof json.mcpServers === "object") {
        for (const [k, v] of Object.entries(json.mcpServers)) {
          if ((v as any).enabled !== false) active.add(k);
        }
      }
    } catch {}
  }

  // Check .gemini/mcp_config.json
  if (existsSync(paths.antigravityFile)) {
    try {
      const json = JSON.parse(readFileSync(paths.antigravityFile, "utf-8"));
      if (json.mcpServers && typeof json.mcpServers === "object") {
        for (const [k, v] of Object.entries(json.mcpServers)) {
          if ((v as any).enabled !== false) active.add(k);
        }
      }
    } catch {}
  }

  return Array.from(active);
}

export function formatForOpenCode(
  servers: string[],
  allDefs: Record<string, RawMcpServer>,
): Record<string, any> {
  const mcpObj: Record<string, any> = {};
  for (const name of servers) {
    const def = allDefs[name];
    if (!def) continue;

    if (def.type === "remote" || def.url) {
      mcpObj[name] = {
        type: "remote",
        url: def.url,
        enabled: true,
        ...(def.headers ? { headers: def.headers } : {}),
      };
    } else {
      const cmdArr = def.command ?? [name];
      mcpObj[name] = {
        type: "local",
        command: cmdArr,
        enabled: true,
        ...(def.env ? { env: def.env } : {}),
        ...(def.timeout ? { timeout: def.timeout } : {}),
      };
    }
  }
  return mcpObj;
}

export function formatForClaude(
  servers: string[],
  allDefs: Record<string, RawMcpServer>,
): Record<string, any> {
  const mcpServers: Record<string, any> = {};
  for (const name of servers) {
    const def = allDefs[name];
    if (!def) continue;

    if (def.type === "remote" || def.url) {
      mcpServers[name] = {
        type: "sse",
        url: def.url,
        ...(def.headers ? { headers: def.headers } : {}),
      };
    } else {
      const cmdArr = def.command ?? [name];
      mcpServers[name] = {
        command: cmdArr[0] ?? name,
        args: cmdArr.slice(1),
        env: def.env ?? {},
      };
    }
  }
  return mcpServers;
}

export function formatForAntigravity(
  servers: string[],
  allDefs: Record<string, RawMcpServer>,
): Record<string, any> {
  const mcpServers: Record<string, any> = {};
  for (const name of servers) {
    const def = allDefs[name];
    if (!def) continue;

    if (def.type === "remote" || def.url) {
      mcpServers[name] = {
        serverUrl: def.url,
        ...(def.headers ? { headers: def.headers } : {}),
      };
    } else {
      const cmdArr = def.command ?? [name];
      mcpServers[name] = {
        command: cmdArr[0] ?? name,
        args: cmdArr.slice(1),
        env: def.env ?? {},
      };
    }
  }
  return mcpServers;
}

export function applyConfigs(
  selectedServers: string[],
  agents: TargetAgent[],
  options: { cwd?: string; dryRun?: boolean } = {},
) {
  const cwd = options.cwd ?? process.cwd();
  const allDefs = getAvailableServers();
  const paths = getProjectPaths(cwd);

  const opencodeData = formatForOpenCode(selectedServers, allDefs);
  const claudeData = formatForClaude(selectedServers, allDefs);
  const antigravityData = formatForAntigravity(selectedServers, allDefs);

  if (options.dryRun) {
    console.log("=== DRY RUN (No files modified) ===");
    if (agents.includes("opencode")) {
      console.log(
        `\n[opencode.json]:\n${JSON.stringify({ mcp: opencodeData }, null, 2)}`,
      );
    }
    if (agents.includes("claude")) {
      console.log(
        `\n[.mcp.json]:\n${JSON.stringify({ mcpServers: claudeData }, null, 2)}`,
      );
    }
    if (agents.includes("antigravity")) {
      console.log(
        `\n[.gemini/mcp_config.json]:\n${JSON.stringify({ mcpServers: antigravityData }, null, 2)}`,
      );
    }
    return;
  }

  // Update opencode.json
  if (agents.includes("opencode")) {
    let existing: Record<string, any> = {};
    if (existsSync(paths.opencodeFile)) {
      try {
        existing = JSON.parse(readFileSync(paths.opencodeFile, "utf-8"));
      } catch {}
    }
    if (selectedServers.length === 0) {
      delete existing.mcp;
      if (Object.keys(existing).length === 0) {
        if (existsSync(paths.opencodeFile)) rmSync(paths.opencodeFile);
        console.log("Removed opencode.json");
      } else {
        writeFileSync(
          paths.opencodeFile,
          JSON.stringify(existing, null, 2) + "\n",
        );
        console.log("Updated opencode.json (cleared mcp)");
      }
    } else {
      existing.mcp = opencodeData;
      writeFileSync(
        paths.opencodeFile,
        JSON.stringify(existing, null, 2) + "\n",
      );
      console.log("Updated opencode.json");
    }
  }

  // Update .mcp.json (Claude)
  if (agents.includes("claude")) {
    let existing: Record<string, any> = {};
    if (existsSync(paths.claudeFile)) {
      try {
        existing = JSON.parse(readFileSync(paths.claudeFile, "utf-8"));
      } catch {}
    }
    if (selectedServers.length === 0) {
      delete existing.mcpServers;
      if (Object.keys(existing).length === 0) {
        if (existsSync(paths.claudeFile)) rmSync(paths.claudeFile);
        console.log("Removed .mcp.json");
      } else {
        writeFileSync(
          paths.claudeFile,
          JSON.stringify(existing, null, 2) + "\n",
        );
        console.log("Updated .mcp.json (cleared mcpServers)");
      }
    } else {
      existing.mcpServers = claudeData;
      writeFileSync(paths.claudeFile, JSON.stringify(existing, null, 2) + "\n");
      console.log("Updated .mcp.json");
    }
  }

  // Update .gemini/mcp_config.json (Antigravity)
  if (agents.includes("antigravity")) {
    const dir = join(cwd, ".gemini");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    let existing: Record<string, any> = {};
    if (existsSync(paths.antigravityFile)) {
      try {
        existing = JSON.parse(readFileSync(paths.antigravityFile, "utf-8"));
      } catch {}
    }
    if (selectedServers.length === 0) {
      delete existing.mcpServers;
      if (Object.keys(existing).length === 0) {
        if (existsSync(paths.antigravityFile)) rmSync(paths.antigravityFile);
        console.log("Removed .gemini/mcp_config.json");
      } else {
        writeFileSync(
          paths.antigravityFile,
          JSON.stringify(existing, null, 2) + "\n",
        );
        console.log("Updated .gemini/mcp_config.json (cleared mcpServers)");
      }
    } else {
      existing.mcpServers = antigravityData;
      writeFileSync(
        paths.antigravityFile,
        JSON.stringify(existing, null, 2) + "\n",
      );
      console.log("Updated .gemini/mcp_config.json");
    }
  }
}

export interface InteractiveMenuResult {
  servers: string[];
  agents: TargetAgent[];
}

// Interactive raw terminal menu with arrow keys, j/k, space to toggle, enter to confirm
export async function runInteractiveMenu(
  initialAgents: TargetAgent[] = ["opencode", "claude", "antigravity"],
): Promise<InteractiveMenuResult | null> {
  const available = getAvailableServers();
  const localActive = new Set(getActiveLocalServers());
  const globalActive = getGlobalActiveServers();

  // All servers sorted alphabetically
  const allServerNames = Object.keys(available).sort();

  if (allServerNames.length === 0) {
    console.log("No MCP servers found in configuration or catalog.");
    return null;
  }

  // Pre-select servers currently active in local project
  const selectedServers = new Set<string>(localActive);

  // Agent selection
  const allAgents: { id: TargetAgent; label: string; file: string }[] = [
    { id: "opencode", label: "OpenCode", file: "opencode.json" },
    { id: "claude", label: "Claude Code", file: ".mcp.json" },
    {
      id: "antigravity",
      label: "Antigravity",
      file: ".gemini/mcp_config.json",
    },
  ];
  const selectedAgents = new Set<TargetAgent>(initialAgents);

  // Total navigable items = Agent rows + Server rows
  // Index 0 .. 2: Agents
  // Index 3 .. (3 + allServerNames.length - 1): Servers
  const totalItems = allAgents.length + allServerNames.length;
  let cursor = 0;

  if (!process.stdin.isTTY) {
    console.error("Interactive menu requires a TTY terminal.");
    return null;
  }

  // Setup raw mode
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  // Enter alternate screen buffer & hide cursor
  process.stdout.write("\x1B[?1049h\x1B[?25l");

  function render() {
    const cols = process.stdout.columns || 80;
    const lines: string[] = [];
    const globalCount = globalActive.size;
    const localCount = selectedServers.size;

    lines.push("MCP Server & Agent Manager (Project Mode)");
    lines.push(`Active global: ${globalCount} | Active local: ${localCount}`);
    lines.push(
      "Keys: [Up/Down or j/k] Navigate | [Space] Toggle | [Enter] Save | [q/Esc] Cancel\n",
    );

    // Section 1: Target Agents
    lines.push("--- Target Agents (generate config for) ---");
    for (let i = 0; i < allAgents.length; i++) {
      const agent = allAgents[i];
      const isCursor = i === cursor;
      const isChecked = selectedAgents.has(agent.id);

      const pointer = isCursor ? ">" : " ";
      const box = isChecked ? "[*]" : "[ ]";
      const lineStr = `${pointer} ${box} ${agent.label.padEnd(16)} (writes to ${agent.file})`;

      if (isCursor) {
        lines.push(`\x1B[1;36m${lineStr}\x1B[0m`);
      } else if (isChecked) {
        lines.push(`\x1B[1;32m${lineStr}\x1B[0m`);
      } else {
        lines.push(lineStr);
      }
    }

    lines.push("\n--- MCP Servers ---");

    // Section 2: MCP Servers
    for (let i = 0; i < allServerNames.length; i++) {
      const name = allServerNames[i];
      const meta = MCP_CATALOG[name] ?? {
        description: "MCP Server",
        ramImpact: "low",
      };

      const itemIndex = allAgents.length + i;
      const isCursor = itemIndex === cursor;
      const isGlobal = globalActive.has(name);
      const isLocal = selectedServers.has(name);

      const pointer = isCursor ? ">" : " ";

      let box = "[ ]";
      let statusTag = "";
      if (isGlobal) {
        box = "[*]";
        statusTag = "[GLOBAL]";
      } else if (isLocal) {
        box = "[*]";
        statusTag = "[LOCAL] ";
      } else {
        box = "[ ]";
        statusTag = "        ";
      }

      const ram = `[${meta.ramImpact.toUpperCase()} RAM]`.padEnd(12);

      const prefix = `${pointer} ${box} ${name.padEnd(20)} ${statusTag} ${ram} - `;
      const availableDescWidth = Math.max(10, cols - prefix.length - 1);
      const desc =
        meta.description.length > availableDescWidth
          ? meta.description.slice(0, availableDescWidth - 3) + "..."
          : meta.description;

      const lineStr = `${prefix}${desc}`;
      if (isCursor) {
        lines.push(`\x1B[1;36m${lineStr}\x1B[0m`);
      } else if (isGlobal) {
        lines.push(`\x1B[1;33m${lineStr}\x1B[0m`);
      } else if (isLocal) {
        lines.push(`\x1B[1;32m${lineStr}\x1B[0m`);
      } else {
        lines.push(lineStr);
      }
    }

    lines.push("");

    // Move to top-left and clear entire screen before writing
    process.stdout.write(`\x1B[H\x1B[2J${lines.join("\n")}\n`);
  }

  render();

  return new Promise((resolveResult) => {
    function cleanup() {
      // Exit alternate screen buffer & show cursor
      process.stdout.write("\x1B[?25h\x1B[?1049l");
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("keypress", onKeypress);
      process.stdout.removeListener("resize", onResize);
    }

    function onResize() {
      render();
    }

    process.stdout.on("resize", onResize);

    function onKeypress(str: string, key: readline.Key) {
      if (!key) return;

      // Exit / Cancel on Ctrl+C, Esc, or q
      if (
        (key.ctrl && key.name === "c") ||
        key.name === "escape" ||
        str === "q"
      ) {
        cleanup();
        console.log("Cancelled.");
        resolveResult(null);
        return;
      }

      // Up navigation
      if (key.name === "up" || str === "k") {
        cursor = (cursor - 1 + totalItems) % totalItems;
        render();
        return;
      }

      // Down navigation
      if (key.name === "down" || str === "j") {
        cursor = (cursor + 1) % totalItems;
        render();
        return;
      }

      // Toggle selection with Space
      if (key.name === "space" || str === " ") {
        if (cursor < allAgents.length) {
          // Toggle agent
          const agent = allAgents[cursor].id;
          if (selectedAgents.has(agent)) {
            // Keep at least 1 agent selected
            if (selectedAgents.size > 1) {
              selectedAgents.delete(agent);
            }
          } else {
            selectedAgents.add(agent);
          }
        } else {
          // Toggle MCP Server
          const serverIndex = cursor - allAgents.length;
          const item = allServerNames[serverIndex];
          if (globalActive.has(item)) {
            // Global servers are always active system-wide
            render();
            return;
          }

          if (selectedServers.has(item)) {
            selectedServers.delete(item);
          } else {
            selectedServers.add(item);
          }
        }
        render();
        return;
      }

      // Confirm with Enter
      if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolveResult({
          servers: Array.from(selectedServers),
          agents: Array.from(selectedAgents),
        });
        return;
      }
    }

    process.stdin.on("keypress", onKeypress);
  });
}

export function printHelp() {
  console.log(`
pmcp - Project MCP Manager
Manage and toggle MCP servers per project to save RAM.

USAGE:
  pmcp [COMMAND] [OPTIONS] [SERVERS...]

COMMANDS:
  (no args)             Open interactive terminal menu
  menu                  Open interactive terminal menu
  add <servers...>      Enable specified servers in current project
  rm, remove <servers>  Disable specified servers in current project
  use, preset <name>    Apply a preset (web, docs, minimal, rust, study, all, none)
  ls, status            List currently active servers (global and local)
  clean, reset          Remove all local MCP project configurations

OPTIONS:
  -a, --agent <agents>  Target agents (default: all; or: opencode,claude,antigravity)
  -y, --yes             Apply immediately without confirmation
  --dry-run             Preview generated JSON without writing to disk
  -h, --help            Show this help message

AVAILABLE PRESETS:
  web / browser         obscura, camoufox (browser automation, scraping)
  docs / minimal        context7, deepwiki (official docs, encyclopedia)
  rust                  rust-anything (Rust analyzer and transpilation)
  study                 anki (AnkiConnect flashcard sync)
  none                  Remove all local MCPs
`);
}

function parseAgents(argVal?: string): TargetAgent[] {
  if (!argVal || argVal === "all") {
    return ["opencode", "claude", "antigravity"];
  }
  const parts = argVal.split(",").map((s) => s.trim().toLowerCase());
  const valid: TargetAgent[] = [];
  for (const p of parts) {
    if (
      p === "opencode" ||
      p === "claude" ||
      p === "antigravity" ||
      p === "gemini"
    ) {
      valid.push(p === "gemini" ? "antigravity" : (p as TargetAgent));
    }
  }
  return valid.length > 0 ? valid : ["opencode", "claude", "antigravity"];
}

export async function main() {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes("-h") || rawArgs.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  const dryRun = rawArgs.includes("--dry-run");
  let agentArg: string | undefined;

  const filteredArgs: string[] = [];
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === "--dry-run" || a === "-y" || a === "--yes") continue;
    if (a === "-a" || a === "--agent") {
      agentArg = rawArgs[++i];
      continue;
    }
    filteredArgs.push(a);
  }

  const agents = parseAgents(agentArg);
  const cmd = filteredArgs[0]?.toLowerCase();

  if (!cmd || cmd === "menu") {
    const result = await runInteractiveMenu(agents);
    if (result === null) {
      return;
    }

    const { servers: selectedServers, agents: targetAgents } = result;

    if (selectedServers.length === 0) {
      console.log("No local servers enabled. Clearing project MCP configs.");
      applyConfigs([], targetAgents, { dryRun });
      return;
    }

    console.log(
      `Configuring for agents [${targetAgents.join(", ")}]: ${selectedServers.join(", ")}`,
    );
    applyConfigs(selectedServers, targetAgents, { dryRun });
    return;
  }

  if (cmd === "ls" || cmd === "status") {
    const globalActive = getGlobalActiveServers();
    const active = getActiveLocalServers();

    console.log(`\nGlobal MCP Servers (always active):`);
    if (globalActive.size === 0) {
      console.log("   (none)");
    } else {
      for (const s of globalActive) {
        const meta = MCP_CATALOG[s];
        console.log(
          `   * ${s.padEnd(20)} [GLOBAL]     - ${meta?.description ?? ""}`,
        );
      }
    }

    console.log(`\nLocal MCP Servers in current project (${process.cwd()}):`);
    if (active.length === 0) {
      console.log("   (No servers active in this project)");
    } else {
      for (const s of active) {
        const meta = MCP_CATALOG[s];
        const ram = meta?.ramImpact
          ? `[${meta.ramImpact.toUpperCase()} RAM]`
          : "";
        console.log(
          `   * ${s.padEnd(20)} ${ram.padEnd(12)} - ${meta?.description ?? ""}`,
        );
      }
    }
    return;
  }

  if (cmd === "clean" || cmd === "reset") {
    applyConfigs([], agents, { dryRun });
    console.log("Cleaned all local MCP project configurations.");
    return;
  }

  if (cmd === "use" || cmd === "preset") {
    const presetName = filteredArgs[1]?.toLowerCase();
    if (!presetName || !PRESETS[presetName]) {
      console.error(
        `Invalid preset. Available presets: ${Object.keys(PRESETS).join(", ")}`,
      );
      process.exit(1);
    }
    const servers = PRESETS[presetName];
    console.log(
      `Applying preset '${presetName}': ${servers.join(", ") || "(none)"}`,
    );
    applyConfigs(servers, agents, { dryRun });
    return;
  }

  if (cmd === "add") {
    const toAdd = filteredArgs.slice(1);
    if (toAdd.length === 0) {
      console.error(
        "Please specify server name(s) to add. Example: pmcp add obscura",
      );
      process.exit(1);
    }
    const current = new Set(getActiveLocalServers());
    for (const s of toAdd) current.add(s);
    const updated = Array.from(current);
    console.log(`Adding to configuration: ${toAdd.join(", ")}`);
    applyConfigs(updated, agents, { dryRun });
    return;
  }

  if (cmd === "rm" || cmd === "remove") {
    const toRemove = filteredArgs.slice(1);
    if (toRemove.length === 0) {
      console.error(
        "Please specify server name(s) to remove. Example: pmcp rm camoufox",
      );
      process.exit(1);
    }
    const current = new Set(getActiveLocalServers());
    for (const s of toRemove) current.delete(s);
    const updated = Array.from(current);
    console.log(`Removing from configuration: ${toRemove.join(", ")}`);
    applyConfigs(updated, agents, { dryRun });
    return;
  }

  // Direct server names (e.g. `pmcp obscura camoufox`)
  const possibleServers = filteredArgs;
  const available = getAvailableServers();
  const valid = possibleServers.filter((s) => available[s] || MCP_CATALOG[s]);
  if (valid.length > 0) {
    console.log(`Setting configuration to: ${valid.join(", ")}`);
    applyConfigs(valid, agents, { dryRun });
    return;
  }

  console.error(`Unknown command or server: ${filteredArgs.join(" ")}`);
  printHelp();
  process.exit(1);
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith("pmcp.ts") ||
    process.argv[1].endsWith("main.mjs") ||
    process.argv[1].endsWith("pmcp"))
) {
  main();
}
