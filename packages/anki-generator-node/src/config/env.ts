import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findProjectRoot(fromDir: string): string {
  let current = path.resolve(fromDir);
  while (true) {
    if (fs.existsSync(path.join(current, "package.json"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) throw new Error("Could not find project root (package.json)");
    current = parent;
  }
}

export const ROOT = findProjectRoot(__dirname);
export const MEDIA_DIR = path.join(ROOT, "media");
export const IMAGE_DIR = path.join(ROOT, "media"); // Consistent with existing implementation where image files go to media

// Ensure directories exist
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}
