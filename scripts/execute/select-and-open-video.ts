#!/usr/bin/env tsx
import { spawnSync } from "child_process";
import { isMain } from "./utils";

function findAndOpenVideo(recursive: boolean): void {
  const fdArgs = ["-t", "f", "-e", "mp4", "-e", "mkv", "-e", "avi", "-e", "mov", "-e", "webm", "-e", "flv"];
  if (!recursive) fdArgs.push("--max-depth", "1");

  const fd = spawnSync("fd", fdArgs, { encoding: "utf-8" });
  if (fd.status !== 0) {
    console.error("fd failed");
    process.exit(1);
  }

  const sorted = fd.stdout?.trim() ?? "";
  if (!sorted) {
    console.log("No video files found.");
    return;
  }

  const fzf = spawnSync("fzf", ["--style", "full", "--prompt", "Select a video: "], {
    input: sorted,
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf-8",
  });

  const file = fzf.stdout?.trim();
  if (!file) {
    console.log("No video selected.");
    return;
  }

  spawnSync("kitten", ["icat", "--clear"], { stdio: "ignore" });
  const child = spawnSync("xdg-open", [file], { stdio: "ignore" });
  if (child.status !== 0) {
    console.error(`Failed to open: ${file}`);
  }
}

function showHelp(): void {
  console.error(`Usage: vd [options]

Options:
  -r    Search recursively (include subdirectories)
  -h    Show this help message

By default, only searches for videos in the current directory.`);
}

function main(): void {
  const args = process.argv.slice(2);
  let recursive = false;

  for (const arg of args) {
    if (arg === "-r") recursive = true;
    else if (arg === "-h") { showHelp(); return; }
  }

  findAndOpenVideo(recursive);
}

if (isMain(import.meta.url)) main();
