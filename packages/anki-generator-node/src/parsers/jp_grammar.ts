import fs from "node:fs";
import path from "node:path";
import { BaseParser } from "./base.js";
import type { JpGrammarItem, MediaAsset, ParsedResult, ParsedCard } from "../types/index.js";
import { downloadAudio } from "../core/audio.js";
import { downloadImage, promptToFilename } from "../core/image.js";
import { MEDIA_DIR } from "../config/env.js";
import {
  convertFuriganaToHtml,
  convertMarkdownToHtml,
  limitConcurrency,
} from "../utils/helpers.js";

const FIELD_NAMES = [
  "Pattern",
  "Reading",
  "Formula",
  "Meaning_VI",
  "Meaning_EN",
  "Meaning_JP",
  "Explanation",
  "Sentence_JP",
  "Sentence_Furigana_HTML",
  "Sentence_Translation",
  "Sentence_Translation_EN",
  "Pattern_Audio",
  "Sentence_Audio",
  "Image_Hint",
  "Usage_Notes",
  "Usage_Notes_EN",
  "Related_Grammar",
  "JLPT_Level",
  "Tags",
] as const;

export class JpGrammarParser extends BaseParser {
  getFieldNames(): readonly string[] {
    return FIELD_NAMES;
  }

  getTemplateName(): string {
    return "jp_grammar";
  }

  async parse(rawJson: string): Promise<ParsedResult> {
    let cleanRaw = rawJson.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    const items: JpGrammarItem[] = JSON.parse(cleanRaw);
    const cards: ParsedCard[] = [];
    const media: MediaAsset[] = [];

    console.log(`JpGrammarParser: Processing ${items.length} items...`);

    const tasks = items.map((item) => async () => {
      const g = item.grammar;
      const ex = item.example || {};
      const mediaFields = item.media || {};
      const notes = item.notes || {};
      const meta = item.meta || {};

      const cleanPattern = g.pattern
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[〜〜~]/g, "")
        .replace(/[/\\?%*:|"<>]/g, "_");
      const patternAudioFilename = `jp_gram_${cleanPattern}.mp3`;
      const sentenceAudioFilename = `jp_gram_sent_${cleanPattern}.mp3`;

      console.log(`- Processing Japanese Grammar: ${g.pattern}`);

      let patternAudioBuffer: Buffer | null = null;
      let hasPatternAudio = false;
      const textToSpeak = g.reading || g.pattern;
      if (textToSpeak) {
        hasPatternAudio = await downloadAudio(textToSpeak, patternAudioFilename, "ja");
        if (hasPatternAudio) {
          const audioPath = path.join(MEDIA_DIR, patternAudioFilename);
          if (fs.existsSync(audioPath)) {
            patternAudioBuffer = fs.readFileSync(audioPath);
          }
        }
      }

      let sentenceAudioBuffer: Buffer | null = null;
      let hasSentenceAudio = false;
      if (ex.sentence_jp) {
        hasSentenceAudio = await downloadAudio(ex.sentence_jp, sentenceAudioFilename, "ja");
        if (hasSentenceAudio) {
          const audioPath = path.join(MEDIA_DIR, sentenceAudioFilename);
          if (fs.existsSync(audioPath)) {
            sentenceAudioBuffer = fs.readFileSync(audioPath);
          }
        }
      }

      let imageHtml = "";
      let imageFilename = "";
      let imageBuffer: Buffer | null = null;
      if (
        mediaFields.image_hint &&
        mediaFields.image_hint !== "N/A" &&
        mediaFields.image_hint.trim() !== ""
      ) {
        if (mediaFields.image_hint.endsWith(".jpg") || mediaFields.image_hint.endsWith(".png")) {
          imageFilename = mediaFields.image_hint;
          imageHtml = `<img src="${imageFilename}" class="card-image">`;
        } else {
          imageFilename = promptToFilename(g.pattern);
          const hasImage = await downloadImage(mediaFields.image_hint, imageFilename);
          if (hasImage) {
            const imgPath = path.join(MEDIA_DIR, imageFilename);
            if (fs.existsSync(imgPath)) {
              imageBuffer = fs.readFileSync(imgPath);
              imageHtml = `<img src="${imageFilename}" class="card-image">`;
            }
          }
        }
      }

      const patternAudioTag = mediaFields.pattern_audio
        ? mediaFields.pattern_audio.startsWith("[sound:")
          ? mediaFields.pattern_audio
          : `[sound:${mediaFields.pattern_audio}]`
        : hasPatternAudio
          ? `[sound:${patternAudioFilename}]`
          : "";

      const sentenceAudioTag = mediaFields.sentence_audio
        ? mediaFields.sentence_audio.startsWith("[sound:")
          ? mediaFields.sentence_audio
          : `[sound:${mediaFields.sentence_audio}]`
        : hasSentenceAudio
          ? `[sound:${sentenceAudioFilename}]`
          : "";

      return {
        card: {
          frontKeyField: g.pattern,
          fields: {
            Pattern: g.pattern,
            Reading: g.reading || "",
            Formula: convertMarkdownToHtml(g.formula),
            Meaning_VI: convertMarkdownToHtml(g.meaning_vi || ""),
            Meaning_EN: convertMarkdownToHtml(g.meaning_en || ""),
            Meaning_JP: convertMarkdownToHtml(g.meaning_jp || ""),
            Explanation: convertMarkdownToHtml(g.explanation || ""),
            Sentence_JP: ex.sentence_jp || "",
            Sentence_Furigana_HTML: convertFuriganaToHtml(
              ex.sentence_furigana || ex.sentence_jp || "",
            ),
            Sentence_Translation: convertMarkdownToHtml(
              ex.sentence_translation || ex.sentence_translation_vi || "",
            ),
            Sentence_Translation_EN: convertMarkdownToHtml(ex.sentence_translation_en || ""),
            Pattern_Audio: patternAudioTag,
            Sentence_Audio: sentenceAudioTag,
            Image_Hint: imageHtml,
            Usage_Notes: convertMarkdownToHtml(notes.usage_notes || ""),
            Usage_Notes_EN: convertMarkdownToHtml(notes.usage_notes_en || ""),
            Related_Grammar: convertMarkdownToHtml(notes.related_grammar || ""),
            JLPT_Level: meta.jlpt_level || "",
            Tags: (meta.tags || []).join(" "),
          },
        },
        media: [
          ...(patternAudioBuffer
            ? [{ filename: patternAudioFilename, buffer: patternAudioBuffer }]
            : []),
          ...(sentenceAudioBuffer
            ? [{ filename: sentenceAudioFilename, buffer: sentenceAudioBuffer }]
            : []),
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
