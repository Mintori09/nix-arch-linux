import fs from "node:fs";
import path from "node:path";
import { IMAGE_DIR } from "../config/env.js";

const MAX_RETRIES = 5;

//  Mutex: only one image request in-flight at a time.
//  Pollinations.ai returns 429 when multiple requests overlap.
let nextSlot = Promise.resolve();

async function takeTurn<T>(fn: () => Promise<T>): Promise<T> {
  const myTurn = nextSlot.then(fn, fn);
  nextSlot = myTurn.then(
    () => {},
    () => {},
  );
  return myTurn;
}

export async function downloadImage(prompt: string, filename: string): Promise<boolean> {
  const filePath = path.join(IMAGE_DIR, filename);
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    return true;
  }

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await takeTurn(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);
        try {
          return await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));
        return true;
      }

      const isRetryable =
        response.status === 429 || (response.status >= 500 && response.status < 600);
      if (isRetryable && attempt < MAX_RETRIES) {
        const retryAfter = response.headers.get("Retry-After");
        const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(3, attempt) * 1000;
        const reason =
          response.status === 429 ? "Rate limited" : `Server error (${response.status})`;
        console.warn(
          `${reason} for "${prompt}". Retrying in ${delayMs / 1000}s... (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      console.error(
        response.status === 429
          ? `Image API returned 429 for "${prompt}" after ${MAX_RETRIES} retries`
          : `Image API returned ${response.status} for "${prompt}"`,
      );
      return false;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delayMs = Math.pow(3, attempt) * 1000;
        console.warn(
          `Error for "${prompt}". Retrying in ${delayMs / 1000}s... (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      console.error(
        `Error downloading image for "${prompt}":`,
        error instanceof Error ? error.message : error,
      );
      return false;
    }
  }

  return false;
}

export function promptToFilename(prompt: string): string {
  if (!prompt || prompt === "N/A") return "";
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return `${slug}.jpg`;
}
