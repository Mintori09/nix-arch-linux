#!/usr/bin/env bun
import fs from "fs";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";

interface CommandInfo {
  input: string;
  found: boolean;
  absolutePath: string | null;
  resolvedPath: string | null;
  isExecutable: boolean;
  isReadable: boolean;
  isSymlink: boolean;
  isZshFunction: boolean;
  functionDefinition?: string;
}

export function resolveRealPath(filePath: string): string {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return filePath;
  }
}

export function getZshFunctionDefinition(commandName: string): string | null {
  const loadAndPrint = `autoload +X ${commandName} 2>/dev/null; functions ${commandName}`;

  const result = spawnSync("zsh", ["-ic", loadAndPrint], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  const output = result.stdout.trim();
  if (
    result.status === 0 &&
    output.length > 0 &&
    !output.includes("undefined")
  ) {
    return output;
  }
  return null;
}

export function findCommandInPath(commandName: string): string | null {
  if (commandName.includes(path.sep)) {
    return fs.existsSync(commandName) ? commandName : null;
  }

  const systemPaths = process.env.PATH?.split(path.delimiter) ?? [];

  for (const directory of systemPaths) {
    const fullPath = path.join(directory, commandName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

export function checkExecutable(filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile() && (stats.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

export function checkReadable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function getDetailedFileType(filePath: string): string {
  const result = spawnSync("file", ["-b", filePath], { encoding: "utf-8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

export function isBatAvailable(): boolean {
  return spawnSync("bat", ["--version"], { stdio: "ignore" }).status === 0;
}

export function inspectCommand(commandName: string): CommandInfo {
  const info: CommandInfo = {
    input: commandName,
    found: false,
    absolutePath: null,
    resolvedPath: null,
    isExecutable: false,
    isReadable: false,
    isSymlink: false,
    isZshFunction: false,
  };

  const zshFunc = getZshFunctionDefinition(commandName);
  if (zshFunc) {
    info.found = true;
    info.isZshFunction = true;
    info.functionDefinition = zshFunc;
    return info;
  }

  const commandPath = findCommandInPath(commandName);
  if (!commandPath) return info;

  info.found = true;
  info.absolutePath = commandPath;

  try {
    info.isSymlink = fs.lstatSync(commandPath).isSymbolicLink();
  } catch {
    info.isSymlink = false;
  }

  const realPath = resolveRealPath(commandPath);
  info.resolvedPath = realPath;
  info.isExecutable = checkExecutable(realPath);
  info.isReadable = checkReadable(realPath);

  return info;
}

function displayPreview(filePath: string): void {
  if (!checkReadable(filePath)) return;
  if (isBatAvailable()) {
    spawnSync(
      "bat",
      [
        "--style=numbers,grid",
        "--paging=never",
        "--color=always",
        "--binary=no-printing",
        filePath,
      ],
      {
        stdio: ["inherit", "inherit", "ignore"],
      },
    );
  } else {
    spawnSync("notify-send", ["Failed!", "Bat is not existed!"], {
      stdio: ["inherit", "inherit", "ignore"],
    });
  }
}

function displayZshFunction(definition: string): void {
  if (!isBatAvailable()) {
    console.log(definition);
    return;
  }

  spawnSync(
    "bat",
    ["--language=zsh", "--style=numbers,grid", "--color=always"],
    {
      input: definition,
      stdio: ["pipe", "inherit", "ignore"],
    },
  );
}

function showMetadata(result: CommandInfo, target: string) {
  // Color Constants
  const reset = "\x1b[0m";
  const red = "\x1b[31m";
  const green = "\x1b[32m";
  const yellow = "\x1b[33m";
  const blue = "\x1b[34m";
  const cyan = "\x1b[36m";
  const bold = "\x1b[1m";

  if (!result.found) {
    console.log(`${red}${bold}✗ Not found:${reset} ${yellow}${target}${reset}`);
    process.exit(1);
  }

  console.log(
    `${cyan}--- Metadata for ${bold}${target}${reset}${cyan} ---${reset}`,
  );

  if (result.isZshFunction) {
    console.log(`${blue}Type:${reset} ${bold}Zsh Function${reset}`);
    displayZshFunction(result.functionDefinition!);
    return;
  }

  // Path and Symlink Logic
  const pathLabel = `${blue}Path:${reset} ${result.absolutePath}`;
  const symlinkArrow = result.isSymlink
    ? ` ${yellow}→${reset} ${cyan}${result.resolvedPath}${reset}`
    : "";
  console.log(`${pathLabel}${symlinkArrow}`);

  // Executable Status
  const execStatus = result.isExecutable
    ? `${green}✓ Executable${reset}`
    : `${red}✕ Not executable${reset}`;
  console.log(execStatus);

  if (result.isReadable) {
    console.log(`${green}✓ Readable${reset}`);
    const fileType = getDetailedFileType(result.resolvedPath!);
    console.log(`${blue}Filetype:${reset} ${fileType}`);

    console.log(`\n${yellow}Preview:${reset}`);
    displayPreview(result.resolvedPath!);
  } else {
    console.log(`${red}✕ Not readable${reset}`);
  }
}

function main(): void {
  const target = process.argv[2];

  if (!target) {
    console.error("Usage: isx <command>");
    process.exit(1);
  }

  const result = inspectCommand(target);

  showMetadata(result, target);
}

if (import.meta.main) {
  main();
}
