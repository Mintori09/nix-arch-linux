import fs from "node:fs";
import path from "node:path";
import { BaseParser } from "./base.js";
import type { GrammarItem, MediaAsset, ParsedResult, ParsedCard } from "../types/index.js";
import { downloadAudio } from "../core/audio.js";
import { downloadImage, promptToFilename } from "../core/image.js";
import { MEDIA_DIR } from "../config/env.js";
import { convertMarkdownToHtml, limitConcurrency } from "../utils/helpers.js";

const FIELD_NAMES = [
  "Word",
  "IPA",
  "WordClass",
  "Definition",
  "Meaning_VN",
  "Meaning_JP",
  "Example",
  "Example_VN",
  "Example_JP",
  "Collocations",
  "Audio",
  "Image",
] as const;

export class GrammarParser extends BaseParser {
  getFieldNames(): readonly string[] {
    return FIELD_NAMES;
  }

  getTemplateName(): string {
    return "grammar";
  }

  async parse(rawJson: string): Promise<ParsedResult> {
    let cleanRaw = rawJson.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    const grammarList: GrammarItem[] = JSON.parse(cleanRaw);
    const cards: ParsedCard[] = [];
    const media: MediaAsset[] = [];

    console.log(`GrammarParser: Processing ${grammarList.length} items...`);

    const tasks = grammarList.map((item) => async () => {
      const cleanPattern = item.pattern
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[/\\?%*:|"<>]/g, "_");
      const audioFilename = `${cleanPattern}.mp3`;

      console.log(`- Processing grammar: ${item.pattern}`);
      const hasAudio = await downloadAudio(item.pattern, audioFilename);
      let audioBuffer: Buffer | null = null;
      if (hasAudio) {
        audioBuffer = fs.readFileSync(path.join(MEDIA_DIR, audioFilename));
      }

      let imageHtml = "";
      let imageFilename = "";
      let imageBuffer: Buffer | null = null;
      if (item.image_prompt && item.image_prompt !== "N/A") {
        imageFilename = promptToFilename(item.pattern);
        const hasImage = await downloadImage(item.image_prompt, imageFilename);
        if (hasImage) {
          imageBuffer = fs.readFileSync(path.join(MEDIA_DIR, imageFilename));
          imageHtml = `<img src="${imageFilename}" class="card-image">`;
        }
      }

      return {
        card: {
          frontKeyField: item.pattern,
          fields: {
            Word: item.pattern,
            IPA: item.formula,
            WordClass: "grammar",
            Definition: convertMarkdownToHtml(item.explanation),
            Meaning_VN: convertMarkdownToHtml(item.meaning_vn),
            Meaning_JP: convertMarkdownToHtml(item.meaning_jp),
            Example: convertMarkdownToHtml(item.example),
            Example_VN: convertMarkdownToHtml(item.example_vn),
            Example_JP: convertMarkdownToHtml(item.example_jp),
            Collocations: convertMarkdownToHtml(item.usage_notes),
            Audio: hasAudio ? `[sound:${audioFilename}]` : "",
            Image: imageHtml,
          },
        },
        media: [
          ...(audioBuffer ? [{ filename: audioFilename, buffer: audioBuffer }] : []),
          ...(imageBuffer ? [{ filename: imageFilename, buffer: imageBuffer }] : []),
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
