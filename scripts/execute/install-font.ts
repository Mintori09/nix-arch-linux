#!/usr/bin/env tsx

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join, parse } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import { args, isMain } from "./utils.ts";

const FONT_DIR = join(homedir(), ".local/share/fonts");

const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

function ensureFontDir() {
  if (!existsSync(FONT_DIR)) {
    mkdirSync(FONT_DIR, { recursive: true });
  }
}

async function downloadFont(url: string, dest: string) {
  console.log(`${colors.blue}Downloading: ${url}${colors.reset}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
  const buffer = await response.arrayBuffer();
  writeFileSync(dest, Buffer.from(buffer));
}

async function copyLocalFont(source: string, dest: string) {
  console.log(`${colors.blue}Copying local font...${colors.reset}`);
  if (!existsSync(source)) throw new Error(`File not found: ${source}`);
  copyFileSync(source, dest);
}

async function extractZip(zipPath: string): Promise<string> {
  const zipFolderName = parse(zipPath).name;
  const extractDir = join(FONT_DIR, zipFolderName);

  console.log(`${colors.blue}Extracting to: ${extractDir}${colors.reset}`);
  mkdirSync(extractDir, { recursive: true });

  spawnSync("unzip", ["-o", zipPath, "-d", extractDir], { stdio: "ignore" });
  rmSync(zipPath, { force: true });

  return extractDir;
}

async function refreshFontCache(path: string) {
  console.log(`${colors.blue}Updating font cache...${colors.reset}`);
  spawnSync("fc-cache", ["-f", path], { stdio: "ignore" });
}

async function installFont(source: string) {
  try {
    ensureFontDir();

    let currentPath = join(FONT_DIR, basename(source));

    if (source.startsWith("http")) {
      await downloadFont(source, currentPath);
    } else {
      await copyLocalFont(source, currentPath);
    }

    if (currentPath.endsWith(".zip")) {
      currentPath = await extractZip(currentPath);
    }

    await refreshFontCache(currentPath);

    console.log(
      `${colors.green}Success! Installed to: ${currentPath}${colors.reset}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`${colors.red}Error: ${msg}${colors.reset}`);
    process.exit(1);
  }
}

const fontArg = args[0];
if (!fontArg) {
  console.log(
    `${colors.yellow}Usage: tsx script.ts <url-or-local-file>${colors.reset}`,
  );
  process.exit(1);
}

if (isMain(import.meta.url)) {
  installFont(fontArg).catch((err: unknown) => {
    console.error(`${colors.red}Error:${colors.reset}`, err);
    process.exit(1);
  });
}
