import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

function getDirname(): string {
  if (typeof __dirname !== "undefined") return __dirname;
  try {
    if (typeof import.meta !== "undefined" && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  return process.cwd();
}

function findProjectRoot(fromDir: string): string {
  let current = path.resolve(fromDir);
  while (true) {
    if (fs.existsSync(path.join(current, "package.json"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return fromDir;
    current = parent;
  }
}

export const ROOT = process.env.ANKI_TOOL_ROOT || findProjectRoot(getDirname());
export const MEDIA_DIR = path.join(ROOT, "media");
export const IMAGE_DIR = path.join(ROOT, "media");

if (!fs.existsSync(MEDIA_DIR)) {
  try {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  } catch {}
}
