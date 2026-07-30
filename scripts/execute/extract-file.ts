#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import path from "node:path";
import { args, isMain } from "./utils.ts";

function extract(file: string, outputDir: string): void {
  const cmds: Record<string, [string, string[]]> = {
    ".tar.bz2": ["tar", ["xvjf", file]],
    ".tar.gz": ["tar", ["xvzf", file]],
    ".tar.xz": ["tar", ["xJf", file]],
    ".tbz2": ["tar", ["xvjf", file]],
    ".tgz": ["tar", ["xvzf", file]],
    ".tar": ["tar", ["xvf", file]],
    ".bz2": ["bunzip2", [file]],
    ".gz": ["gunzip", [file]],
    ".zip": ["unzip", [file]],
    ".7z": ["7z", ["x", file]],
    ".rar": ["unrar", ["x", file]],
    ".Z": ["uncompress", [file]],
    ".rpm": ["bsdtar", ["-xvf", file]],
    ".epub": ["unzip", [file]],
    ".deb": ["ar", ["x", file]],
  };

  for (const [ext, [cmd, cmdArgs]] of Object.entries(cmds)) {
    if (file.endsWith(ext)) {
      const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", cwd: outputDir });
      if (r.status !== 0) process.exit(r.status ?? 1);
      return;
    }
  }
  console.error(`> '${file}' cannot be extracted via this script`);
}

function usage(): void {
  console.error(`Usage: extract [-d <dir>|--dir <dir>] <file1> [file2 ...]

Extract archive files into the current directory (default) or a target directory.

Options:
  -d, --dir <dir>   extract into the specified directory (default: .)
  -h, --help        show this help`);
}

function parseArgs(args: string[]): { outputDir: string; files: string[] } {
  let outputDir = ".";
  const files: string[] = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i]!;

    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    }

    if (arg === "-d" || arg === "--dir") {
      i += 1;
      if (i >= args.length) {
        console.error("Error: -d/--dir requires a directory argument");
        process.exit(1);
      }
      outputDir = args[i]!;
      i += 1;
      continue;
    }

    if (arg.startsWith("-") && arg !== "--") {
      console.error(`Error: unknown option: ${arg}`);
      usage();
      process.exit(1);
    }

    files.push(arg);
    i += 1;
  }

  return { outputDir, files };
}

function ensureDirectory(dir: string): string {
  const resolved = path.resolve(dir);
  if (!existsSync(resolved)) {
    console.error(`> '${dir}': no such directory`);
    process.exit(1);
  }
  if (!lstatSync(resolved).isDirectory()) {
    console.error(`> '${dir}': not a directory`);
    process.exit(1);
  }
  return resolved;
}

function main(): void {
  const { outputDir, files } = parseArgs(args);

  if (files.length === 0) {
    console.error(`Error: missing file arguments`);
    usage();
    process.exit(1);
  }

  const dir = ensureDirectory(outputDir);

  for (const file of files) {
    const resolvedFile = path.resolve(file);
    if (spawnSync("test", ["-f", resolvedFile]).status !== 0) {
      console.error(`> '${file}' is not a valid file!`);
      continue;
    }
    console.log(`Extracting '${file}' into '${path.relative(process.cwd(), dir) || "."}'...`);
    extract(resolvedFile, dir);
  }
}

if (isMain(import.meta.url)) main();
