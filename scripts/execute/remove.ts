#!/usr/bin/env deno run -A

import { unlink, rmdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileGroups } from "./file-groups.ts";
import { spawn, args, isMain } from "./utils.ts";
const command = args[0];
const flags = new Set(args.slice(1));

const validFlags = new Set([
  "-r",
  "--recursive",
  "-n",
  "--dry-run",
  "-e",
  "--remove-empty-dirs",
  "-h",
  "--help",
]);

function help() {
  const commands = Object.entries(fileGroups)
    .map(
      ([name, target]) =>
        `  ${name.padEnd(12)} Remove ${target.description.toLowerCase()}`,
    )
    .join("\n");

  console.log(`remove — simple file removal utility

Usage:
  remove <command> [options]

Commands:
${commands}

Options:
  -r, --recursive         Search in subdirectories
  -n, --dry-run           Show files without deleting
  -e, --remove-empty-dirs Remove empty parent directories after deletion
  -h, --help              Show this help message

Examples:
  remove subtitles
  remove subtitles -r
  remove subtitles -n
  remove images --dry-run
  remove text --recursive
  remove text -e
`);
}

function exitWithHelp(code = 0): never {
  help();
  Deno.exit(code);
}

function validateFlags() {
  const unknownFlags = [...flags].filter((flag) => !validFlags.has(flag));

  if (unknownFlags.length > 0) {
    console.error(`Unknown option: ${unknownFlags.join(", ")}\n`);
    exitWithHelp(1);
  }
}

async function collectFiles(
  extensions: string[],
  recursive: boolean,
): Promise<string[]> {
  const fdArgs = [
    "fd",
    "--type",
    "file",
    "--print0",
    ...extensions.flatMap((ext) => ["--extension", ext]),
  ];

  if (!recursive) {
    fdArgs.push("--max-depth", "1");
  }

  const child = spawn(fdArgs[0], fdArgs.slice(1), {
    stdio: ["ignore", "pipe", "inherit"],
  });
  let collected = "";
  child.stdout.on("data", (d: Buffer) => (collected += d.toString()));
  const code = await new Promise<number>((resolve) => {
    child.on("close", (c) => resolve(c ?? 0));
  });

  if (code !== 0) {
    console.error("Failed to collect files.");
Deno.exit(code);
  }

  return collected
    .split("\0")
    .map((file) => file.trim())
    .filter(Boolean);
}

async function removeFiles(files: string[]): Promise<string[]> {
  const removed: string[] = [];
  let failed = 0;

  for (const file of files) {
    try {
      await unlink(file);
      removed.push(file);
    } catch (error) {
      failed++;
      console.error(`Failed to remove: ${file}`);
    }
  }

  console.log(`\nRemoved ${removed.length} file(s).`);

  if (failed > 0) {
    console.error(`Failed to remove ${failed} file(s).`);
    Deno.exit(1);
  }

  return removed;
}

async function removeEmptyParentDirs(files: string[]) {
  const dirs = new Set(files.map((f) => dirname(f)));
  let removed = 0;

  for (const dir of dirs) {
    try {
      await rmdir(dir);
      console.log(`Removed empty directory: ${dir}`);
      removed++;
    } catch {
      // Directory not empty or other error — skip silently
    }
  }

  if (removed > 0) {
    console.log(`\nRemoved ${removed} empty director(ies).`);
  }
}

if (isMain(import.meta.url)) {
  (async () => {
    if (!command || args.includes("-h") || args.includes("--help")) {
      exitWithHelp(0);
    }

    validateFlags();

    const target = fileGroups[command];

    if (!target) {
      console.error(`Unknown command: ${command}\n`);
      exitWithHelp(1);
    }

    const recursive = flags.has("-r") || flags.has("--recursive");
    const dryRun = flags.has("-n") || flags.has("--dry-run");
    const removeEmptyDirs = flags.has("-e") || flags.has("--remove-empty-dirs");

    const files = await collectFiles(target.extensions, recursive);

    if (files.length === 0) {
      console.log("No files found.");
      Deno.exit(0);
    }

    console.log(`${dryRun ? "Found" : "Removing"} ${files.length} file(s):\n`);
    console.log(files.join("\n"));

    if (dryRun) {
      console.log("\nDry run enabled. No files were removed.");
      Deno.exit(0);
    }

    const removedFiles = await removeFiles(files);

    if (removeEmptyDirs) {
      await removeEmptyParentDirs(removedFiles);
    }
  })();
}

export {};
