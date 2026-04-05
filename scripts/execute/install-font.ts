#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync, mkdirSync } from "node:fs";
import { basename, join, parse } from "node:path";
import { homedir } from "node:os";

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
  await Bun.write(dest, buffer);
}

async function copyLocalFont(source: string, dest: string) {
  console.log(`${colors.blue}Copying local font...${colors.reset}`);
  if (!existsSync(source)) throw new Error(`File not found: ${source}`);
  await $`cp ${source} ${dest}`;
}

async function extractZip(zipPath: string): Promise<string> {
  const zipFolderName = parse(zipPath).name;
  const extractDir = join(FONT_DIR, zipFolderName);

  console.log(`${colors.blue}Extracting to: ${extractDir}${colors.reset}`);
  mkdirSync(extractDir, { recursive: true });

  await $`unzip -o ${zipPath} -d ${extractDir}`.quiet();
  await $`rm -f ${zipPath}`.quiet();

  return extractDir;
}

async function refreshFontCache(path: string) {
  console.log(`${colors.blue}Updating font cache...${colors.reset}`);
  await $`fc-cache -f ${path}`.quiet();
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

const fontArg = Bun.argv[2];
if (!fontArg) {
  console.log(
    `${colors.yellow}Usage: bun run script.ts <url-or-local-file>${colors.reset}`,
  );
  process.exit(1);
}

await installFont(fontArg);
