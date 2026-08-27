import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { MEDIA_DIR } from "../config/env.js";

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[/\\?%*:|"<>]/g, "_");
}

export function downloadAudio(word: string, filename: string, lang = "en"): Promise<boolean> {
  return new Promise((resolve) => {
    const safeFilename = sanitizeFilename(filename);
    const filePath = path.join(MEDIA_DIR, safeFilename);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
      resolve(true);
      return;
    }

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(word)}`;

    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode !== 200) {
          resolve(false);
          return;
        }
        const fileStream = fs.createWriteStream(filePath);

        fileStream.on("error", (err) => {
          console.error(`Error writing audio file for "${word}":`, err.message);
          resolve(false);
        });

        res.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close();
          resolve(true);
        });
      })
      .on("error", (err) => {
        console.error(`Error downloading audio for "${word}":`, err.message);
        resolve(false);
      });
  });
}
