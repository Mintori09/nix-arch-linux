#!/usr/bin/env tsx

import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import { args, isMain } from "./utils.ts";

export const DEFAULT_LARGE_TEXT_BYTES = 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  ".bash",
  ".c",
  ".cc",
  ".cfg",
  ".conf",
  ".cpp",
  ".css",
  ".csv",
  ".cxx",
  ".diff",
  ".env",
  ".fish",
  ".go",
  ".h",
  ".hpp",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".json",
  ".json5",
  ".jsx",
  ".kdl",
  ".kt",
  ".kts",
  ".log",
  ".lua",
  ".md",
  ".mdx",
  ".nix",
  ".patch",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".svelte",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".vim",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
  ".zsh",
]);

const TEXT_NAMES = new Set([
  ".bash_profile",
  ".bashrc",
  ".gitconfig",
  ".gitignore",
  ".profile",
  ".zprofile",
  ".zshenv",
  ".zshrc",
  "CHANGELOG",
  "Dockerfile",
  "LICENSE",
  "Makefile",
  "README",
]);

export type OpenConfig = {
  largeTextBytes: number;
  largeTextEditor: string;
  projectEditor: string;
  smallTextEditor: string;
  terminal: string;
  xdgOpen: string;
};

export type OpenPlan = {
  args: string[];
  command: string;
  detach: boolean;
  kind: "project-editor" | "terminal-editor" | "xdg-open";
};

export type ParsedArgs = {
  projectMode: boolean;
  targets: string[];
};

type PlanOpenTargetOptions = {
  config: OpenConfig;
  isDirectory: boolean;
  mimeType: string | null;
  path: string;
  sizeBytes: number;
};

export function parseOpenConfig(
  env: Record<string, string | undefined>,
): OpenConfig {
  const parsedLargeTextBytes = Number.parseInt(
    env.OPEN_LARGE_TEXT_BYTES ?? "",
    10,
  );

  return {
    largeTextBytes:
      Number.isFinite(parsedLargeTextBytes) && parsedLargeTextBytes > 0
        ? parsedLargeTextBytes
        : DEFAULT_LARGE_TEXT_BYTES,
    largeTextEditor: env.OPEN_LARGE_TEXT_EDITOR || "hx",
    projectEditor: env.OPEN_PROJECT_EDITOR || "zeditor",
    smallTextEditor: env.OPEN_SMALL_TEXT_EDITOR || "nvim",
    terminal: env.OPEN_TERMINAL || "kitty",
    xdgOpen: env.OPEN_XDG_OPEN || "xdg-open",
  };
}

export function parseArgs(args: string[]): ParsedArgs {
  let projectMode = false;
  const targets: string[] = [];

  for (const arg of args) {
    if (arg === "--project" || arg === "-p") {
      projectMode = true;
      continue;
    }

    targets.push(arg);
  }

  return { projectMode, targets };
}

export function isUrl(target: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(target);
}

export function isProbablyTextMime(mimeType: string | null): boolean {
  if (mimeType === null) {
    return false;
  }

  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/toml" ||
    mimeType === "application/xml" ||
    mimeType === "application/yaml" ||
    mimeType === "application/x-shellscript"
  );
}

export function isProbablyTextPath(path: string): boolean {
  const name = basename(path);
  if (TEXT_NAMES.has(name)) {
    return true;
  }

  const extension = extname(name);
  return TEXT_EXTENSIONS.has(extension.toLowerCase());
}

export function planOpenTarget(options: PlanOpenTargetOptions): OpenPlan {
  const { config, isDirectory, mimeType, path, sizeBytes } = options;
  const shouldUseEditor =
    !isDirectory && (isProbablyTextMime(mimeType) || isProbablyTextPath(path));

  if (!shouldUseEditor) {
    return {
      args: [config.xdgOpen, path],
      command: config.xdgOpen,
      detach: true,
      kind: "xdg-open",
    };
  }

  const editor =
    sizeBytes >= config.largeTextBytes
      ? config.largeTextEditor
      : config.smallTextEditor;

  return {
    args: [config.terminal, editor, path],
    command: config.terminal,
    detach: true,
    kind: "terminal-editor",
  };
}

async function detectMimeType(path: string): Promise<string | null> {
  const child = spawn("file", ["--brief", "--mime-type", path], {
    stdio: ["inherit", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (d: Buffer) => (output += d.toString()));
  const exitCode = await new Promise<number>((resolve) => {
    child.on("close", (c) => resolve(c ?? 0));
  });
  output = output.trim();

  if (exitCode !== 0 || output === "") {
    return null;
  }

  return output;
}

export async function buildOpenCommand(
  target: string,
  config = parseOpenConfig(process.env),
  projectMode = false,
): Promise<OpenPlan> {
  if (projectMode) {
    return {
      args: [config.projectEditor, target],
      command: config.projectEditor,
      detach: true,
      kind: "project-editor",
    };
  }

  if (isUrl(target) || !existsSync(target)) {
    return {
      args: [config.xdgOpen, target],
      command: config.xdgOpen,
      detach: true,
      kind: "xdg-open",
    };
  }

  const stats = statSync(target);
  const mimeType = stats.isDirectory()
    ? "inode/directory"
    : await detectMimeType(target);

  return planOpenTarget({
    config,
    isDirectory: stats.isDirectory(),
    mimeType,
    path: target,
    sizeBytes: stats.size,
  });
}

function printUsage(): void {
  console.error("Usage: open [--project|-p] <target> [target ...]");
}

async function main(): Promise<number> {
  const parsedArgs = parseArgs(args);

  if (parsedArgs.targets.length === 0) {
    printUsage();
    return 2;
  }

  for (const target of parsedArgs.targets) {
    const plan = await buildOpenCommand(
      target,
      parseOpenConfig(process.env),
      parsedArgs.projectMode,
    );
    const child = spawn(plan.args[0], plan.args.slice(1), {
      stdio: "ignore",
    });

    child.unref();
  }

  return 0;
}

if (isMain(import.meta.url)) {
  main().then((code) => process.exit(code));
}
