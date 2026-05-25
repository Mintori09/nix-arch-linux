#!/usr/bin/env deno run -A
import { spawnSync } from "node:child_process";
import { args, isMain } from "./utils.ts";

function extract(file: string): void {
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
      const r = spawnSync(cmd, cmdArgs, { stdio: "inherit" });
      if (r.status !== 0) Deno.exit(r.status ?? 1);
      return;
    }
  }
  console.error(`> '${file}' cannot be extracted via this script`);
}

function main(): void {
  const files = args;
  if (files.length === 0) {
    console.error(`Usage: extract <file1> [file2 ...]`);
    Deno.exit(1);
  }
  for (const file of files) {
    if (spawnSync("test", ["-f", file]).status !== 0) {
      console.error(`> '${file}' is not a valid file!`);
      continue;
    }
    console.log(`Extracting '${file}'...`);
    extract(file);
  }
}

if (isMain(import.meta.url)) main();
