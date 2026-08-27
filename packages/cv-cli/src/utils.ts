import { fileURLToPath } from "node:url";
import { access } from "node:fs/promises";
import { constants as FS_CONSTANTS } from "node:fs";

export const args: string[] = process.argv.slice(2);

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isMain(metaUrl: string): boolean {
  return fileURLToPath(metaUrl) === process.argv[1];
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, FS_CONSTANTS.F_OK);
    return true;
  } catch {
    return false;
  }
}

export const COLORS = {
  RED: "\x1b[31m",
  CYAN: "\x1b[36m",
  GREEN: "\x1b[32m",
  MAGENTA: "\x1b[35m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  GRAY: "\x1b[90m",
  NC: "\x1b[0m",
} as const;
