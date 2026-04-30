#!/usr/bin/env bun

import { fileGroups } from "./file-groups";

const args = Bun.argv.slice(2);
const command = args[0];
const flags = new Set(args.slice(1));

function help() {
  const commands = Object.entries(fileGroups)
    .map(([name, target]) => `  ${name.padEnd(12)} Remove ${target.description.toLowerCase()}`)
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

async function collectFiles(extensions: string[], recursive: boolean) {
  const fdArgs = [
    "fd",
    "--type",
    "file",
    ...extensions.flatMap((ext) => ["--extension", ext]),
  ];

  if (!recursive) {
    fdArgs.push("--max-depth", "1");
  }

  const proc = Bun.spawn(fdArgs, {
    stdout: "pipe",
    stderr: "inherit",
  });

  const output = await new Response(proc.stdout).text();
  const code = await proc.exited;

  if (code !== 0) process.exit(code);

  return output
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}

async function removeFiles(files: string[]) {
  const proc = Bun.spawn(["rm", "-f", "--", ...files], {
    stdout: "inherit",
    stderr: "inherit",
  });

  const code = await proc.exited;
  if (code !== 0) process.exit(code);
}

if (!command || args.includes("-h") || args.includes("--help")) {
  exitWithHelp(0);
}

const target = fileGroups[command];

if (!target) {
  exitWithHelp(1);
}

const recursive = flags.has("-r") || flags.has("--recursive");
const dryRun = flags.has("-n") || flags.has("--dry-run");

const files = await collectFiles(target.extensions, recursive);

if (files.length === 0) {
  process.exit(0);
}

console.log(files.join("\n"));

if (!dryRun) {
  await removeFiles(files);
}

export {};
