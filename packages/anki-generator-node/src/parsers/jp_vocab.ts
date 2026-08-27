import fs from "node:fs";
import path from "node:path";
import { BaseParser } from "./base.js";
import type { JpVocabItem, MediaAsset, ParsedResult, ParsedCard } from "../types/index.js";
import { downloadAudio } from "../core/audio.js";
import { downloadImage, promptToFilename } from "../core/image.js";
import { MEDIA_DIR } from "../config/env.js";
import {
  convertFuriganaToHtml,
  convertMarkdownToHtml,
  limitConcurrency,
} from "../utils/helpers.js";

const FIELD_NAMES = [
  "Kanji_Expression",
  "Kana_Reading",
  "Furigana_HTML",
  "Pitch_Accent",
  "Pitch_Graph_URL",
  "Part_Of_Speech",
  "Meaning_VI",
  "Sentence_JP",
  "Sentence_Furigana_HTML",
  "Sentence_Translation",
  "Cloze_Front",
  "Word_Audio",
  "Sentence_Audio",
  "Image_Hint",
  "Mnemonic",
  "Nuance",
  "JLPT_Level",
  "Tags",
] as const;

export class JpVocabParser extends BaseParser {
  getFieldNames(): readonly string[] {
    return FIELD_NAMES;
  }

  getTemplateName(): string {
    return "jp_vocab";
  }

  async parse(rawJson: string): Promise<ParsedResult> {
    let cleanRaw = rawJson.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    const items: JpVocabItem[] = JSON.parse(cleanRaw);
    const cards: ParsedCard[] = [];
    const media: MediaAsset[] = [];

    console.log(`JpVocabParser: Processing ${items.length} items...`);

    const tasks = items.map((item) => async () => {
      const vocab = item.vocabulary;
      const ctx = item.context || {};
      const mediaFields = item.media || {};
      const notes = item.notes || {};
      const meta = item.meta || {};

      const cleanKanji = vocab.kanji_expression
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[/\\?%*:|"<>]/g, "_");
      const wordAudioFilename = `jp_word_${cleanKanji}.mp3`;
      const sentenceAudioFilename = `jp_sent_${cleanKanji}.mp3`;

      console.log(`- Processing Japanese Vocab: ${vocab.kanji_expression}`);

      let wordAudioBuffer: Buffer | null = null;
      let hasWordAudio = false;
      if (vocab.kana_reading || vocab.kanji_expression) {
        const textToSpeak = vocab.kana_reading || vocab.kanji_expression;
        hasWordAudio = await downloadAudio(textToSpeak, wordAudioFilename, "ja");
        if (hasWordAudio) {
          const audioPath = path.join(MEDIA_DIR, wordAudioFilename);
          if (fs.existsSync(audioPath)) {
            wordAudioBuffer = fs.readFileSync(audioPath);
          }
        }
      }

      let sentenceAudioBuffer: Buffer | null = null;
      let hasSentenceAudio = false;
      if (ctx.sentence_jp) {
        hasSentenceAudio = await downloadAudio(ctx.sentence_jp, sentenceAudioFilename, "ja");
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
          imageFilename = promptToFilename(vocab.kanji_expression);
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

      const wordAudioTag = mediaFields.word_audio
        ? mediaFields.word_audio.startsWith("[sound:")
          ? mediaFields.word_audio
          : `[sound:${mediaFields.word_audio}]`
        : hasWordAudio
          ? `[sound:${wordAudioFilename}]`
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
          frontKeyField: vocab.kanji_expression,
          fields: {
            Kanji_Expression: vocab.kanji_expression,
            Kana_Reading: vocab.kana_reading,
            Furigana_HTML: convertFuriganaToHtml(vocab.furigana_format || vocab.kanji_expression),
            Pitch_Accent: vocab.pitch_accent || "",
            Pitch_Graph_URL: vocab.pitch_graph_url || "",
            Part_Of_Speech: vocab.part_of_speech,
            Meaning_VI: convertMarkdownToHtml(vocab.meaning_vi),
            Sentence_JP: ctx.sentence_jp || "",
            Sentence_Furigana_HTML: convertFuriganaToHtml(
              ctx.sentence_furigana || ctx.sentence_jp || "",
            ),
            Sentence_Translation: convertMarkdownToHtml(ctx.sentence_translation || ""),
            Cloze_Front: convertFuriganaToHtml(ctx.cloze_front || ""),
            Word_Audio: wordAudioTag,
            Sentence_Audio: sentenceAudioTag,
            Image_Hint: imageHtml,
            Mnemonic: convertMarkdownToHtml(notes.mnemonic || ""),
            Nuance: convertMarkdownToHtml(notes.nuance || ""),
            JLPT_Level: meta.jlpt_level || "",
            Tags: (meta.tags || []).join(" "),
          },
        },
        media: [
          ...(wordAudioBuffer ? [{ filename: wordAudioFilename, buffer: wordAudioBuffer }] : []),
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
