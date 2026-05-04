#!/usr/bin/env bun

import { unlink } from "node:fs/promises";
import { fileGroups } from "./file-groups";

const args = Bun.argv.slice(2);
const command = args[0];
const flags = new Set(args.slice(1));

const validFlags = new Set([
  "-r",
  "--recursive",
  "-n",
  "--dry-run",
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
  -r, --recursive  Search in subdirectories
  -n, --dry-run    Show files without deleting
  -h, --help       Show this help message

Examples:
  remove subtitles
  remove subtitles -r
  remove subtitles -n
  remove images --dry-run
  remove text --recursive
`);
}

function exitWithHelp(code = 0): never {
  help();
  process.exit(code);
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

  const proc = Bun.spawn(fdArgs, {
    stdout: "pipe",
    stderr: "inherit",
  });

  const output = await new Response(proc.stdout).arrayBuffer();
  const code = await proc.exited;

  if (code !== 0) {
    console.error("Failed to collect files.");
    process.exit(code);
  }

  return new TextDecoder()
    .decode(output)
    .split("\0")
    .map((file) => file.trim())
    .filter(Boolean);
}

async function removeFiles(files: string[]) {
  let removed = 0;
  let failed = 0;

  for (const file of files) {
    try {
      await unlink(file);
      removed++;
    } catch (error) {
      failed++;
      console.error(`Failed to remove: ${file}`);
    }
  }

  console.log(`\nRemoved ${removed} file(s).`);

  if (failed > 0) {
    console.error(`Failed to remove ${failed} file(s).`);
    process.exit(1);
  }
}

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

const files = await collectFiles(target.extensions, recursive);

if (files.length === 0) {
  console.log("No files found.");
  process.exit(0);
}

console.log(`${dryRun ? "Found" : "Removing"} ${files.length} file(s):\n`);
console.log(files.join("\n"));

if (dryRun) {
  console.log("\nDry run enabled. No files were removed.");
  process.exit(0);
}

await removeFiles(files);

export {};
