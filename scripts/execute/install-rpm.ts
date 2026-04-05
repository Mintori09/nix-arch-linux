#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, join, isAbsolute } from "node:path";

/**
 * Configuration & UI
 */
const COLORS = {
  BLUE: "\x1b[34m",
  GREEN: "\x1b[32m",
  RED: "\x1b[31m",
  YELLOW: "\x1b[33m",
  NC: "\x1b[0m",
};

const Log = {
  info: (msg: string) => console.log(`${COLORS.BLUE}info:${COLORS.NC} ${msg}`),
  success: (msg: string) =>
    console.log(`${COLORS.GREEN}success:${COLORS.NC} ${msg}`),
  warn: (msg: string) =>
    console.log(`${COLORS.YELLOW}warning:${COLORS.NC} ${msg}`),
  error: (msg: string) =>
    console.error(`${COLORS.RED}error:${COLORS.NC} ${msg}`),
};

const REQUIRED_BINARIES = ["rpm2cpio", "cpio", "zstd", "file"];

/**
 * Logic
 */
async function checkDependencies() {
  const missing = [];
  for (const bin of REQUIRED_BINARIES) {
    try {
      await $`which ${bin}`.quiet();
    } catch {
      missing.push(bin);
    }
  }

  if (missing.length > 0) {
    Log.error(`Missing dependencies: ${missing.join(", ")}`);
    console.log(
      `${COLORS.YELLOW}Suggestion:${COLORS.NC} sudo pacman -S rpm-tools zstd cpio file`,
    );
    process.exit(1);
  }
}

function resolvePath(inputPath: string): string {
  return isAbsolute(inputPath) ? inputPath : join(process.cwd(), inputPath);
}

function setupWorkspace(
  rpmFile: string | undefined,
  destFolder: string | undefined,
) {
  if (!rpmFile) {
    Log.error("Usage: bun install-rpm.ts <path-to-rpm> [destination-folder]");
    process.exit(1);
  }

  const absoluteRpmPath = resolvePath(rpmFile);
  if (!existsSync(absoluteRpmPath)) {
    Log.error(`File not found: ${absoluteRpmPath}`);
    process.exit(1);
  }

  const targetDir = destFolder
    ? resolvePath(destFolder)
    : join(process.cwd(), "extracted_rpm");

  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }
  mkdirSync(targetDir, { recursive: true });

  return { absoluteRpmPath, targetDir };
}

async function getDecompressor(rpmPath: string): Promise<string> {
  try {
    const fileInfo = await $`rpm2cpio "${rpmPath}" | file -`.text();
    const infoLower = fileInfo.toLowerCase();

    if (infoLower.includes("zstandard")) return "zstd -d";
    if (infoLower.includes("xz")) return "xz -d";
    if (infoLower.includes("gzip")) return "gzip -d";
    if (infoLower.includes("cpio")) return "cat";

    Log.warn("Unknown compression format, defaulting to zstd...");
    return "zstd -d";
  } catch {
    return "zstd -d";
  }
}

async function extractRpm(rpmPath: string, targetDir: string) {
  Log.info(`Extracting ${basename(rpmPath)}...`);
  const decompressor = await getDecompressor(rpmPath);

  try {
    // We use sh -c here because of the complex pipe and redirection
    const cmd = `rpm2cpio "${rpmPath}" | ${decompressor} | cpio -idmv`;
    await $`sh -c "cd ${targetDir} && ${cmd}"`.quiet();
    Log.success("Extraction finished.");
  } catch (err) {
    Log.error(
      "Extraction failed. Check if the RPM is corrupted or permissions are insufficient.",
    );
    process.exit(1);
  }
}

async function confirmStep(message: string): Promise<boolean> {
  process.stdout.write(`${COLORS.YELLOW}??${COLORS.NC} ${message} [y/N]: `);
  for await (const line of console) {
    return line.trim().toLowerCase() === "y";
  }
  return false;
}

async function performDeployment(sourceDir: string) {
  Log.info("Deploying to root filesystem (sudo required)...");
  try {
    // -a: archive mode (preserves symlinks, permissions, etc.)
    await $`sudo cp -av ${sourceDir}/. /`;
    Log.success("Deployment complete.");
  } catch (err) {
    Log.error("Deployment failed during file copy.");
    process.exit(1);
  } finally {
    rmSync(sourceDir, { recursive: true, force: true });
  }
}

/**
 * Main Execution
 */
async function main() {
  await checkDependencies();

  const [, , rpmInput, destInput] = Bun.argv;
  const { absoluteRpmPath, targetDir } = setupWorkspace(rpmInput, destInput);

  await extractRpm(absoluteRpmPath, targetDir);

  const shouldInstall = await confirmStep("Proceed with installation to /?");

  if (shouldInstall) {
    await performDeployment(targetDir);
  } else {
    Log.info("Installation cancelled. Cleaning up workspace...");
    rmSync(targetDir, { recursive: true, force: true });
  }
}

main();
