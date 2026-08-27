import fs from "node:fs";
import https from "node:https";
import http from "node:http";
import path from "node:path";
import { BaseParser } from "./base.js";
import type { MCQListeningItem, ParsedResult, ParsedCard, MediaAsset } from "../types/index.js";
import { downloadAudio, sanitizeFilename } from "../core/audio.js";
import { downloadImage, promptToFilename } from "../core/image.js";
import { MEDIA_DIR } from "../config/env.js";
import { convertMarkdownToHtml, limitConcurrency } from "../utils/helpers.js";

const FIELD_NAMES = [
  "Image",
  "Audio",
  "Question",
  "OptionsB64",
  "CorrectAnswersB64",
  "Explanation",
] as const;

async function downloadFileFromUrl(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode !== 200) {
          resolve(false);
          return;
        }
        const fileStream = fs.createWriteStream(destPath);
        fileStream.on("error", () => resolve(false));
        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close();
          resolve(true);
        });
      })
      .on("error", () => resolve(false));
  });
}

export class MCQListeningParser extends BaseParser {
  getFieldNames(): readonly string[] {
    return FIELD_NAMES;
  }

  getTemplateName(): string {
    return "mcq-listening";
  }

  async parse(rawJson: string): Promise<ParsedResult> {
    let cleanRaw = rawJson.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    const mcqList: MCQListeningItem[] = JSON.parse(cleanRaw);
    const cards: ParsedCard[] = [];
    const media: MediaAsset[] = [];

    console.log(`MCQListeningParser: Processing ${mcqList.length} items...`);

    const tasks = mcqList.map((item, index) => async () => {
      // 1. Process Image
      let imageHtml = "";
      let imageFilename = "";
      let imageBuffer: Buffer | null = null;

      const rawImage = (item.image || item.image_prompt || "").trim();
      if (rawImage && rawImage !== "N/A") {
        const isUrl = rawImage.startsWith("http://") || rawImage.startsWith("https://");
        const isLocalFile =
          !isUrl &&
          (rawImage.endsWith(".jpg") ||
            rawImage.endsWith(".jpeg") ||
            rawImage.endsWith(".png") ||
            rawImage.endsWith(".webp") ||
            rawImage.endsWith(".gif") ||
            rawImage.endsWith(".svg"));

        if (isUrl) {
          const ext = path.extname(new URL(rawImage).pathname) || ".jpg";
          imageFilename = sanitizeFilename(`mcq_img_${index}_${Date.now()}${ext}`);
          const destPath = path.join(MEDIA_DIR, imageFilename);
          const ok = await downloadFileFromUrl(rawImage, destPath);
          if (ok && fs.existsSync(destPath)) {
            imageBuffer = fs.readFileSync(destPath);
            imageHtml = `<img src="${imageFilename}" class="card-image">`;
          }
        } else if (isLocalFile) {
          const candidatePaths = [
            path.isAbsolute(rawImage) ? rawImage : path.resolve(process.cwd(), rawImage),
            path.join(MEDIA_DIR, path.basename(rawImage)),
          ];
          const foundPath = candidatePaths.find((p) => fs.existsSync(p));
          if (foundPath) {
            imageFilename = sanitizeFilename(path.basename(foundPath));
            imageBuffer = fs.readFileSync(foundPath);
            imageHtml = `<img src="${imageFilename}" class="card-image">`;
          } else {
            console.warn(`MCQListeningParser: Image file not found: ${rawImage}`);
          }
        } else {
          imageFilename = promptToFilename(`mcq_img_${index}_${rawImage.slice(0, 30)}`);
          const hasImage = await downloadImage(rawImage, imageFilename);
          if (hasImage) {
            const imgPath = path.join(MEDIA_DIR, imageFilename);
            if (fs.existsSync(imgPath)) {
              imageBuffer = fs.readFileSync(imgPath);
              imageHtml = `<img src="${imageFilename}" class="card-image">`;
            }
          }
        }
      }

      // 2. Process Audio
      let audioFilename = "";
      let audioBuffer: Buffer | null = null;
      let audioTag = "";

      const rawAudio = (item.audio || "").trim();
      const textToSpeak = (item.audio_text || item.question || "").trim();

      if (rawAudio) {
        const isUrl = rawAudio.startsWith("http://") || rawAudio.startsWith("https://");
        if (isUrl) {
          const ext = path.extname(new URL(rawAudio).pathname) || ".mp3";
          audioFilename = sanitizeFilename(`mcq_audio_${index}_${Date.now()}${ext}`);
          const destPath = path.join(MEDIA_DIR, audioFilename);
          const ok = await downloadFileFromUrl(rawAudio, destPath);
          if (ok && fs.existsSync(destPath)) {
            audioBuffer = fs.readFileSync(destPath);
            audioTag = `[sound:${audioFilename}]`;
          }
        } else {
          const candidatePaths = [
            path.isAbsolute(rawAudio) ? rawAudio : path.resolve(process.cwd(), rawAudio),
            path.join(MEDIA_DIR, path.basename(rawAudio)),
          ];
          const foundPath = candidatePaths.find((p) => fs.existsSync(p));
          if (foundPath) {
            audioFilename = sanitizeFilename(path.basename(foundPath));
            audioBuffer = fs.readFileSync(foundPath);
            audioTag = `[sound:${audioFilename}]`;
          } else {
            console.warn(`MCQListeningParser: Audio file not found: ${rawAudio}`);
          }
        }
      }

      if (!audioTag && textToSpeak) {
        audioFilename = sanitizeFilename(`mcq_tts_${index}_${Date.now()}.mp3`);
        const hasAudio = await downloadAudio(textToSpeak, audioFilename);
        if (hasAudio) {
          const audioPath = path.join(MEDIA_DIR, audioFilename);
          if (fs.existsSync(audioPath)) {
            audioBuffer = fs.readFileSync(audioPath);
            audioTag = `[sound:${audioFilename}]`;
          }
        }
      }

      // 3. Process Options & Answers
      const optionsArray = Object.entries(item.options || {}).map(([key, value]) => ({
        key: key.trim().toLowerCase(),
        label: key.trim().toUpperCase(),
        text: String(value).trim(),
      }));
      const optionsB64 = Buffer.from(JSON.stringify(optionsArray)).toString("base64");

      const answersArray = Array.isArray(item.answer)
        ? item.answer.map((ans) => String(ans).trim().toLowerCase())
        : String(item.answer || "")
            .split(",")
            .map((ans) => ans.trim().toLowerCase())
            .filter(Boolean);
      const correctAnswersB64 = Buffer.from(JSON.stringify(answersArray)).toString("base64");

      const questionText = item.question ? convertMarkdownToHtml(item.question) : "";
      const frontKey =
        item.question || (item.options ? Object.values(item.options)[0] : `Q${index + 1}`);

      return {
        card: {
          frontKeyField: frontKey,
          fields: {
            Image: imageHtml,
            Audio: audioTag,
            Question: questionText,
            OptionsB64: optionsB64,
            CorrectAnswersB64: correctAnswersB64,
            Explanation: item.explanation ? convertMarkdownToHtml(item.explanation) : "",
          },
        },
        media: [
          ...(imageBuffer ? [{ filename: imageFilename, buffer: imageBuffer }] : []),
          ...(audioBuffer ? [{ filename: audioFilename, buffer: audioBuffer }] : []),
        ],
      };
    });

    const results = await limitConcurrency(tasks, 5);

    for (const res of results) {
      cards.push(res.card);
      media.push(...res.media);
    }

    return { cards, media };
  }
}
