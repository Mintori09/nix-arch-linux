#!/usr/bin/env node

// src/index.ts
import fs12 from "node:fs";
import path12 from "node:path";

// src/parsers/vocab.ts
import fs4 from "node:fs";
import path4 from "node:path";

// src/parsers/base.ts
var BaseParser = class {};

// src/core/audio.ts
import fs2 from "node:fs";
import https from "node:https";
import path2 from "node:path";

// src/config/env.ts
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
function findProjectRoot(fromDir) {
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
var ROOT = findProjectRoot(__dirname);
var MEDIA_DIR = path.join(ROOT, "media");
var IMAGE_DIR = path.join(ROOT, "media");
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// src/core/audio.ts
function sanitizeFilename(filename) {
  return filename.replace(/[/\\?%*:|"<>]/g, "_");
}
function downloadAudio(word, filename, lang = "en") {
  return new Promise((resolve) => {
    const safeFilename = sanitizeFilename(filename);
    const filePath = path2.join(MEDIA_DIR, safeFilename);
    if (fs2.existsSync(filePath) && fs2.statSync(filePath).size > 0) {
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
        const fileStream = fs2.createWriteStream(filePath);
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

// src/core/image.ts
import fs3 from "node:fs";
import path3 from "node:path";
var MAX_RETRIES = 5;
var nextSlot = Promise.resolve();
async function takeTurn(fn) {
  const myTurn = nextSlot.then(fn, fn);
  nextSlot = myTurn.then(
    () => {},
    () => {},
  );
  return myTurn;
}
async function downloadImage(prompt, filename) {
  const filePath = path3.join(IMAGE_DIR, filename);
  if (fs3.existsSync(filePath) && fs3.statSync(filePath).size > 0) {
    return true;
  }
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await takeTurn(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12e4);
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
        await fs3.promises.writeFile(filePath, Buffer.from(arrayBuffer));
        return true;
      }
      if (response.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = response.headers.get("Retry-After");
        const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1e3 : Math.pow(3, attempt) * 1e3;
        console.warn(
          `Rate limited for "${prompt}". Retrying in ${delayMs / 1e3}s... (attempt ${attempt + 1}/${MAX_RETRIES})`,
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
        const delayMs = Math.pow(3, attempt) * 1e3;
        console.warn(
          `Error for "${prompt}". Retrying in ${delayMs / 1e3}s... (attempt ${attempt + 1}/${MAX_RETRIES})`,
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
function promptToFilename(prompt) {
  if (!prompt || prompt === "N/A") return "";
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return `${slug}.jpg`;
}

// src/parsers/vocab.ts
var FIELD_NAMES = [
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
];
var VocabParser = class extends BaseParser {
  getFieldNames() {
    return FIELD_NAMES;
  }
  getTemplateName() {
    return "vocab";
  }
  async parse(rawJson) {
    let cleanRaw = rawJson.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    const vocabList = JSON.parse(cleanRaw);
    const cards = [];
    const media = [];
    console.log(`VocabParser: Processing ${vocabList.length} items...`);
    const tasks = vocabList.map((item) => async () => {
      const cleanWord = item.word
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[/\\?%*:|"<>]/g, "_");
      const audioFilename = `${cleanWord}.mp3`;
      console.log(`- Processing: ${item.word}`);
      const hasAudio = await downloadAudio(item.word, audioFilename);
      let audioBuffer = null;
      if (hasAudio) {
        audioBuffer = fs4.readFileSync(path4.join(MEDIA_DIR, audioFilename));
      }
      let imageHtml = "";
      let imageFilename = "";
      let imageBuffer = null;
      if (item.image_prompt && item.image_prompt !== "N/A") {
        imageFilename = promptToFilename(item.word);
        const hasImage = await downloadImage(item.image_prompt, imageFilename);
        if (hasImage) {
          imageBuffer = fs4.readFileSync(path4.join(MEDIA_DIR, imageFilename));
          imageHtml = `<img src="${imageFilename}" class="card-image">`;
        }
      }
      return {
        card: {
          frontKeyField: item.word,
          fields: {
            Word: item.word,
            IPA: item.ipa,
            WordClass: item.word_class,
            Definition: convertMarkdownToHtml(item.definition),
            Meaning_VN: convertMarkdownToHtml(item.meaning_vn),
            Meaning_JP: convertMarkdownToHtml(item.meaning_jp),
            Example: convertMarkdownToHtml(item.example),
            Example_VN: convertMarkdownToHtml(item.example_vn),
            Example_JP: convertMarkdownToHtml(item.example_jp),
            Collocations: convertMarkdownToHtml(item.collocations),
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
};

// src/parsers/grammar.ts
import fs5 from "node:fs";
import path5 from "node:path";
var FIELD_NAMES2 = [
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
];
var GrammarParser = class extends BaseParser {
  getFieldNames() {
    return FIELD_NAMES2;
  }
  getTemplateName() {
    return "grammar";
  }
  async parse(rawJson) {
    let cleanRaw = rawJson.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    const grammarList = JSON.parse(cleanRaw);
    const cards = [];
    const media = [];
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
      let audioBuffer = null;
      if (hasAudio) {
        audioBuffer = fs5.readFileSync(path5.join(MEDIA_DIR, audioFilename));
      }
      let imageHtml = "";
      let imageFilename = "";
      let imageBuffer = null;
      if (item.image_prompt && item.image_prompt !== "N/A") {
        imageFilename = promptToFilename(item.pattern);
        const hasImage = await downloadImage(item.image_prompt, imageFilename);
        if (hasImage) {
          imageBuffer = fs5.readFileSync(path5.join(MEDIA_DIR, imageFilename));
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
};

// src/parsers/mcq.ts
var FIELD_NAMES3 = ["Question", "OptionsB64", "CorrectAnswersB64", "Explanation"];
var MCQParser = class extends BaseParser {
  getFieldNames() {
    return FIELD_NAMES3;
  }
  getTemplateName() {
    return "mcq";
  }
  async parse(rawJson) {
    let cleanRaw = rawJson.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    const mcqList = JSON.parse(cleanRaw);
    const cards = [];
    console.log(`MCQParser: Processing ${mcqList.length} items...`);
    for (const item of mcqList) {
      const optionsArray = Object.entries(item.options).map(([key, value]) => ({
        key: key.trim().toLowerCase(),
        label: key.trim().toUpperCase(),
        text: value.trim(),
      }));
      const optionsB64 = Buffer.from(JSON.stringify(optionsArray)).toString("base64");
      const answersArray = item.answer.split(",").map((ans) => ans.trim().toLowerCase());
      const correctAnswersB64 = Buffer.from(JSON.stringify(answersArray)).toString("base64");
      cards.push({
        frontKeyField: item.question,
        fields: {
          Question: convertMarkdownToHtml(item.question),
          OptionsB64: optionsB64,
          CorrectAnswersB64: correctAnswersB64,
          Explanation: convertMarkdownToHtml(item.explanation),
        },
      });
    }
    return { cards, media: [] };
  }
};

// src/parsers/mcq-listening.ts
import fs6 from "node:fs";
import https2 from "node:https";
import http from "node:http";
import path6 from "node:path";
var FIELD_NAMES4 = ["Image", "Audio", "Question", "OptionsB64", "CorrectAnswersB64", "Explanation"];
async function downloadFileFromUrl(url, destPath) {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https2 : http;
    client
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode !== 200) {
          resolve(false);
          return;
        }
        const fileStream = fs6.createWriteStream(destPath);
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
var MCQListeningParser = class extends BaseParser {
  getFieldNames() {
    return FIELD_NAMES4;
  }
  getTemplateName() {
    return "mcq-listening";
  }
  async parse(rawJson) {
    let cleanRaw = rawJson.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    const mcqList = JSON.parse(cleanRaw);
    const cards = [];
    const media = [];
    console.log(`MCQListeningParser: Processing ${mcqList.length} items...`);
    const tasks = mcqList.map((item, index) => async () => {
      let imageHtml = "";
      let imageFilename = "";
      let imageBuffer = null;
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
          const ext = path6.extname(new URL(rawImage).pathname) || ".jpg";
          imageFilename = sanitizeFilename(`mcq_img_${index}_${Date.now()}${ext}`);
          const destPath = path6.join(MEDIA_DIR, imageFilename);
          const ok = await downloadFileFromUrl(rawImage, destPath);
          if (ok && fs6.existsSync(destPath)) {
            imageBuffer = fs6.readFileSync(destPath);
            imageHtml = `<img src="${imageFilename}" class="card-image">`;
          }
        } else if (isLocalFile) {
          const candidatePaths = [
            path6.isAbsolute(rawImage) ? rawImage : path6.resolve(process.cwd(), rawImage),
            path6.join(MEDIA_DIR, path6.basename(rawImage)),
          ];
          const foundPath = candidatePaths.find((p) => fs6.existsSync(p));
          if (foundPath) {
            imageFilename = sanitizeFilename(path6.basename(foundPath));
            imageBuffer = fs6.readFileSync(foundPath);
            imageHtml = `<img src="${imageFilename}" class="card-image">`;
          } else {
            console.warn(`MCQListeningParser: Image file not found: ${rawImage}`);
          }
        } else {
          imageFilename = promptToFilename(`mcq_img_${index}_${rawImage.slice(0, 30)}`);
          const hasImage = await downloadImage(rawImage, imageFilename);
          if (hasImage) {
            const imgPath = path6.join(MEDIA_DIR, imageFilename);
            if (fs6.existsSync(imgPath)) {
              imageBuffer = fs6.readFileSync(imgPath);
              imageHtml = `<img src="${imageFilename}" class="card-image">`;
            }
          }
        }
      }
      let audioFilename = "";
      let audioBuffer = null;
      let audioTag = "";
      const rawAudio = (item.audio || "").trim();
      const textToSpeak = (item.audio_text || item.question || "").trim();
      if (rawAudio) {
        const isUrl = rawAudio.startsWith("http://") || rawAudio.startsWith("https://");
        if (isUrl) {
          const ext = path6.extname(new URL(rawAudio).pathname) || ".mp3";
          audioFilename = sanitizeFilename(`mcq_audio_${index}_${Date.now()}${ext}`);
          const destPath = path6.join(MEDIA_DIR, audioFilename);
          const ok = await downloadFileFromUrl(rawAudio, destPath);
          if (ok && fs6.existsSync(destPath)) {
            audioBuffer = fs6.readFileSync(destPath);
            audioTag = `[sound:${audioFilename}]`;
          }
        } else {
          const candidatePaths = [
            path6.isAbsolute(rawAudio) ? rawAudio : path6.resolve(process.cwd(), rawAudio),
            path6.join(MEDIA_DIR, path6.basename(rawAudio)),
          ];
          const foundPath = candidatePaths.find((p) => fs6.existsSync(p));
          if (foundPath) {
            audioFilename = sanitizeFilename(path6.basename(foundPath));
            audioBuffer = fs6.readFileSync(foundPath);
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
          const audioPath = path6.join(MEDIA_DIR, audioFilename);
          if (fs6.existsSync(audioPath)) {
            audioBuffer = fs6.readFileSync(audioPath);
            audioTag = `[sound:${audioFilename}]`;
          }
        }
      }
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
};

// src/parsers/basic.ts
var FIELD_NAMES5 = ["Front", "Back"];
var BasicParser = class extends BaseParser {
  getFieldNames() {
    return FIELD_NAMES5;
  }
  getTemplateName() {
    return "basic";
  }
  async parse(rawJson) {
    let cleanRaw = rawJson.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    const basicList = JSON.parse(cleanRaw);
    const cards = [];
    console.log(`BasicParser: Processing ${basicList.length} items...`);
    for (const item of basicList) {
      cards.push({
        frontKeyField: item.front,
        fields: {
          Front: convertMarkdownToHtml(item.front),
          Back: convertMarkdownToHtml(item.back),
        },
      });
    }
    return { cards, media: [] };
  }
};

// src/parsers/jp_grammar.ts
import fs7 from "node:fs";
import path7 from "node:path";
var FIELD_NAMES6 = [
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
];
var JpGrammarParser = class extends BaseParser {
  getFieldNames() {
    return FIELD_NAMES6;
  }
  getTemplateName() {
    return "jp_grammar";
  }
  async parse(rawJson) {
    let cleanRaw = rawJson.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    const items = JSON.parse(cleanRaw);
    const cards = [];
    const media = [];
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
      let patternAudioBuffer = null;
      let hasPatternAudio = false;
      const textToSpeak = g.reading || g.pattern;
      if (textToSpeak) {
        hasPatternAudio = await downloadAudio(textToSpeak, patternAudioFilename, "ja");
        if (hasPatternAudio) {
          const audioPath = path7.join(MEDIA_DIR, patternAudioFilename);
          if (fs7.existsSync(audioPath)) {
            patternAudioBuffer = fs7.readFileSync(audioPath);
          }
        }
      }
      let sentenceAudioBuffer = null;
      let hasSentenceAudio = false;
      if (ex.sentence_jp) {
        hasSentenceAudio = await downloadAudio(ex.sentence_jp, sentenceAudioFilename, "ja");
        if (hasSentenceAudio) {
          const audioPath = path7.join(MEDIA_DIR, sentenceAudioFilename);
          if (fs7.existsSync(audioPath)) {
            sentenceAudioBuffer = fs7.readFileSync(audioPath);
          }
        }
      }
      let imageHtml = "";
      let imageFilename = "";
      let imageBuffer = null;
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
            const imgPath = path7.join(MEDIA_DIR, imageFilename);
            if (fs7.existsSync(imgPath)) {
              imageBuffer = fs7.readFileSync(imgPath);
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
};

// src/utils/helpers.ts
function parseJsonInput(raw) {
  let cleanRaw = raw.trim();
  if (cleanRaw.startsWith("```")) {
    cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(cleanRaw);
  } catch (error) {
    throw new Error("Invalid JSON content.");
  }
}
var SCHEMAS = {
  vocab: [
    { name: "word", type: "string" },
    { name: "ipa", type: "string" },
    { name: "word_class", type: "string" },
    { name: "definition", type: "string" },
    { name: "meaning_vn", type: "string" },
    { name: "meaning_jp", type: "string" },
    { name: "example", type: "string" },
    { name: "example_vn", type: "string" },
    { name: "example_jp", type: "string" },
    { name: "collocations", type: "string" },
    { name: "image_prompt", type: "string" },
  ],
  grammar: [
    { name: "pattern", type: "string" },
    { name: "formula", type: "string" },
    { name: "explanation", type: "string" },
    { name: "meaning_vn", type: "string" },
    { name: "meaning_jp", type: "string" },
    { name: "example", type: "string" },
    { name: "example_vn", type: "string" },
    { name: "example_jp", type: "string" },
    { name: "usage_notes", type: "string" },
    { name: "image_prompt", type: "string", optional: true },
  ],
  mcq: [
    { name: "question", type: "string" },
    { name: "options", type: "object" },
    { name: "answer", type: "string" },
    { name: "explanation", type: "string" },
  ],
  "mcq-shuffle": [
    { name: "question", type: "string" },
    { name: "options", type: "object" },
    { name: "answer", type: "string" },
    { name: "explanation", type: "string" },
  ],
  mcq_shuffle: [
    { name: "question", type: "string" },
    { name: "options", type: "object" },
    { name: "answer", type: "string" },
    { name: "explanation", type: "string" },
  ],
  "mcq-listening": [
    { name: "image", type: "string", optional: true },
    { name: "image_prompt", type: "string", optional: true },
    { name: "audio", type: "string", optional: true },
    { name: "audio_text", type: "string", optional: true },
    { name: "question", type: "string", optional: true },
    { name: "options", type: "object" },
    { name: "answer", type: "string" },
    { name: "explanation", type: "string", optional: true },
  ],
  mcq_listening: [
    { name: "image", type: "string", optional: true },
    { name: "image_prompt", type: "string", optional: true },
    { name: "audio", type: "string", optional: true },
    { name: "audio_text", type: "string", optional: true },
    { name: "question", type: "string", optional: true },
    { name: "options", type: "object" },
    { name: "answer", type: "string" },
    { name: "explanation", type: "string", optional: true },
  ],
  basic: [
    { name: "front", type: "string" },
    { name: "back", type: "string" },
  ],
  jp_vocab: [{ name: "vocabulary", type: "object" }],
  jp_grammar: [{ name: "grammar", type: "object" }],
};
function printSchema(strategy, schema) {
  console.error('  Required fields for type "' + strategy + '":');
  for (const f of schema) {
    const tag = f.optional ? "  (optional)" : "  (required)";
    console.error("    " + tag + ' "' + f.name + '" (' + f.type + ")");
  }
}
function validateJsonStructure(data, strategy) {
  const schema = SCHEMAS[strategy];
  if (!schema) return;
  if (!Array.isArray(data)) {
    console.error("");
    console.error("=== JSON Structure Error ===");
    console.error("");
    console.error("  Expected: A JSON array of objects at the top level.");
    console.error("  Got:      " + (data === null ? "null" : typeof data));
    console.error("");
    console.error("  When using --type " + strategy + ", your JSON file must contain");
    console.error("  an array of items wrapped in [ ]. Currently it contains a");
    console.error("  single " + (data === null ? "null" : typeof data) + " instead.");
    console.error("");
    console.error("  Correct format:");
    console.error('    [ { "field1": "...", "field2": "..." } ]');
    console.error("");
    console.error("  Your content (truncated):");
    try {
      console.error("    " + JSON.stringify(data).slice(0, 200));
    } catch (_) {
      console.error("    (unable to display)");
    }
    process.exit(1);
  }
  if (data.length === 0) {
    console.error("");
    console.error("=== JSON Structure Error ===");
    console.error("");
    console.error("  The JSON array is empty ([]).");
    console.error("  There must be at least one item to compile.");
    process.exit(1);
  }
  const requiredFields = schema.filter((f) => !f.optional);
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      const typeName = item === null ? "null" : Array.isArray(item) ? "array" : typeof item;
      console.error("");
      console.error("=== JSON Structure Error ===");
      console.error("");
      console.error("  Item #" + i + " (type: " + strategy + ")");
      console.error("  Reason: Item is not an object. Got: " + typeName);
      console.error("");
      console.error("  Each item in the array must be a JSON object ( { } ).");
      console.error("  Value: " + JSON.stringify(item).slice(0, 150));
      process.exit(1);
    }
    const missingFields = requiredFields.filter((f) => !(f.name in item)).map((f) => f.name);
    if (missingFields.length > 0) {
      console.error("");
      console.error("=== JSON Structure Error ===");
      console.error("");
      console.error("  Item #" + i + " (type: " + strategy + ")");
      console.error("  Reason: Missing required field(s):");
      for (const f of missingFields) {
        console.error('    - "' + f + '"');
      }
      console.error("");
      printSchema(strategy, schema);
      console.error("");
      console.error("  Fields actually present in this item (" + Object.keys(item).length + "):");
      const itemKeys = Object.keys(item);
      if (itemKeys.length === 0) {
        console.error("    (none \u2014 the item is an empty object {})");
      } else {
        for (const k of itemKeys) {
          console.error('    - "' + k + '"');
          const match = requiredFields.find((f) => {
            const dist = levenshtein(k.toLowerCase(), f.name.toLowerCase());
            return dist > 0 && dist <= 2;
          });
          if (match) {
            console.error('      (Did you mean "' + match.name + '" instead of "' + k + '"?)');
          }
        }
      }
      process.exit(1);
    }
    for (const field of schema) {
      if (field.optional && !(field.name in item)) continue;
      const value = item[field.name];
      const actualType =
        field.type === "object"
          ? typeof value === "object" && value !== null && !Array.isArray(value)
            ? "object"
            : typeof value
          : typeof value;
      if (actualType !== field.type) {
        console.error("");
        console.error("=== JSON Structure Error ===");
        console.error("");
        console.error("  Item #" + i + " (type: " + strategy + ")");
        console.error('  Field: "' + field.name + '"');
        console.error("  Reason: Wrong type. Expected " + field.type + ", got " + actualType + ".");
        console.error(
          "  Value: " + (value === void 0 ? "undefined" : JSON.stringify(value).slice(0, 150)),
        );
        if (field.type === "string" && actualType === "number") {
          console.error('  Hint: Wrap the number in double quotes: "' + value + '"');
        } else if (field.type === "string") {
          console.error("  Hint: Ensure the value is a string in double quotes.");
        } else if (field.type === "object") {
          console.error(
            '  Hint: This field must be an object, e.g. {"a": "choice 1", "b": "choice 2"}',
          );
        }
        process.exit(1);
      }
    }
  }
}
function levenshtein(a, b) {
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] =
        b[i - 1] === a[j - 1]
          ? m[i - 1][j - 1]
          : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[b.length][a.length];
}
function convertMarkdownToHtml(text) {
  if (!text) return "";
  const codeBlocks = [];
  const blockRegex = /```(\w*)\r?\n([\s\S]*?)\r?\n```/g;
  let formatted = text.replace(blockRegex, (match, lang, code) => {
    const escapedCode = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const langClass = lang ? ` class="language-${lang}"` : "";
    const placeholder = `:::CODEBLOCK${codeBlocks.length}:::`;
    codeBlocks.push(`<pre><code${langClass}>${escapedCode}</code></pre>`);
    return placeholder;
  });
  formatted = formatted.replace(/(\*\*\*|___)(.*?)\1/g, "<strong><em>$2</em></strong>");
  formatted = formatted.replace(/(\*\*|__)(.*?)\1/g, "<strong>$2</strong>");
  formatted = formatted.replace(/(\*|_)(.*?)\1/g, "<em>$2</em>");
  formatted = formatted.replace(/~~(.*?)~~/g, "<del>$1</del>");
  formatted = formatted.replace(/`([^`]+)`/g, (match, code) => {
    const escapedInline = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<code>${escapedInline}</code>`;
  });
  formatted = formatted.replace(/\r?\n/g, "<br>");
  codeBlocks.forEach((html, index) => {
    formatted = formatted.replace(`:::CODEBLOCK${index}:::`, html);
  });
  return formatted;
}
function convertFuriganaToHtml(text) {
  if (!text) return "";
  return text.replace(/([一-龯ヶヶ]+)\[([^\]]+)\]/g, "<ruby>$1<rt>$2</rt></ruby>");
}
async function limitConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  const executing = [];
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const p = (async () => {
      results[i] = await task();
    })();
    executing.push(p);
    if (limit <= tasks.length) {
      const cleanExecuting = async () => {
        await p;
        const index = executing.indexOf(p);
        if (index > -1) executing.splice(index, 1);
      };
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
      cleanExecuting();
    }
  }
  await Promise.all(executing);
  return results;
}

// src/core/generator.ts
import fs9 from "node:fs";
import path9 from "node:path";
import { createRequire } from "node:module";
import ankiPkg from "anki-apkg-export";

// src/core/template.ts
import fs8 from "node:fs";
import path8 from "node:path";
function loadFrontHtml(templateName) {
  const customPath = path8.join(ROOT, "templates", templateName, "front.html");
  if (fs8.existsSync(customPath)) {
    return fs8.readFileSync(customPath, "utf-8").trim();
  }
  return fs8.readFileSync(path8.join(ROOT, "templates", "front.html"), "utf-8").trim();
}
function loadBackHtml(templateName) {
  const customPath = path8.join(ROOT, "templates", templateName, "back.html");
  if (fs8.existsSync(customPath)) {
    return fs8.readFileSync(customPath, "utf-8").trim();
  }
  return fs8.readFileSync(path8.join(ROOT, "templates", "back.html"), "utf-8").trim();
}
function resolveCssImports(cssContent, visited = /* @__PURE__ */ new Set()) {
  const importRegex = /@import\s+(?:url\((['"]?)([^'")]+)\1\)|(['"])([^'"]+)\3);?/g;
  return cssContent.replace(importRegex, (_, _quote1, file1, _quote2, file2) => {
    const filename = file1 || file2;
    if (!filename) return "";
    if (filename === "card.css") return "";
    const importedPath = path8.join(ROOT, "styles", filename);
    if (visited.has(importedPath)) return "";
    visited.add(importedPath);
    if (fs8.existsSync(importedPath)) {
      const content = fs8.readFileSync(importedPath, "utf-8").trim();
      return resolveCssImports(content, visited);
    }
    return "";
  });
}
function loadCss(templateName) {
  const basePath = path8.join(ROOT, "styles", "card.css");
  const baseCss = fs8.readFileSync(basePath, "utf-8").trim();
  if (templateName && templateName !== "card") {
    const customPath = path8.join(ROOT, "styles", `${templateName}.css`);
    if (fs8.existsSync(customPath)) {
      const customCss = fs8.readFileSync(customPath, "utf-8").trim();
      const resolvedCustomCss = resolveCssImports(
        customCss,
        /* @__PURE__ */ new Set([customPath, basePath]),
      );
      return `${baseCss}

${resolvedCustomCss}`.trim();
    }
  }
  return baseCss;
}
function createAnkiTemplate(frontHtml, backHtml, css, fieldNames) {
  const flds = fieldNames.map((name, i) => ({
    name,
    media: [],
    sticky: false,
    rtl: false,
    ord: i,
    font: "Arial",
    size: 20,
  }));
  const models = {
    1388596687391: {
      veArs: [],
      name: "Dynamic-Anki-Card",
      tags: ["Tag"],
      did: 1435588830424,
      usn: -1,
      req: [[0, "all", [0]]],
      flds,
      sortf: 0,
      latexPre:
        "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
      tmpls: [
        {
          name: "Anki Card",
          qfmt: frontHtml,
          did: null,
          bafmt: "",
          afmt: backHtml,
          ord: 0,
          bqfmt: "",
        },
      ],
      latexPost: "\\end{document}",
      type: 0,
      id: 1388596687391,
      css,
      mod: 1435645658,
    },
  };
  const decks = {
    1: {
      desc: "",
      name: "Default",
      extendRev: 50,
      usn: 0,
      collapsed: false,
      newToday: [0, 0],
      timeToday: [0, 0],
      dyn: 0,
      extendNew: 10,
      conf: 1,
      revToday: [0, 0],
      lrnToday: [0, 0],
      id: 1,
      mod: 1435645724,
    },
    1435588830424: {
      desc: "",
      name: "Template",
      extendRev: 50,
      usn: -1,
      collapsed: false,
      newToday: [545, 0],
      timeToday: [545, 0],
      dyn: 0,
      extendNew: 10,
      conf: 1,
      revToday: [545, 0],
      lrnToday: [545, 0],
      id: 1435588830424,
      mod: 1435588830,
    },
  };
  const dconf = {
    1: {
      name: "Default",
      replayq: true,
      lapse: {
        leechFails: 8,
        minInt: 1,
        delays: [10],
        leechAction: 0,
        mult: 0,
      },
      rev: {
        perDay: 100,
        fuzz: 0.05,
        ivlFct: 1,
        maxIvl: 36500,
        ease4: 1.3,
        bury: true,
        minSpace: 1,
      },
      timer: 0,
      maxTaken: 60,
      usn: 0,
      new: {
        perDay: 20,
        delays: [1, 10],
        separate: true,
        ints: [1, 4, 7],
        initialFactor: 2500,
        bury: true,
        order: 1,
      },
      mod: 0,
      id: 1,
      autoplay: true,
    },
  };
  return [
    "PRAGMA foreign_keys=OFF;",
    "BEGIN TRANSACTION;",
    "CREATE TABLE col (id integer primary key,crt integer not null,mod integer not null,scm integer not null,ver integer not null,dty integer not null,usn integer not null,ls integer not null,conf text not null,models text not null,decks text not null,dconf text not null,tags text not null);",
    `INSERT INTO "col" VALUES(1,1388548800,1435645724219,1435645724215,11,0,0,0,'${JSON.stringify({ nextPos: 1, estTimes: true, activeDecks: [1], sortType: "noteFld", timeLim: 0, sortBackwards: false, addToCur: true, curDeck: 1, newBury: true, newSpread: 0, dueCounts: true, curModel: "1435645724216", collapseTime: 1200 })}','${escapeJson(JSON.stringify(models))}','${escapeJson(JSON.stringify(decks))}','${escapeJson(JSON.stringify(dconf))}','{}');`,
    "CREATE TABLE notes (id integer primary key,guid text not null,mid integer not null,mod integer not null,usn integer not null,tags text not null,flds text not null,sfld integer not null,csum integer not null,flags integer not null,data text not null);",
    "CREATE TABLE cards (id integer primary key,nid integer not null,did integer not null,ord integer not null,mod integer not null,usn integer not null,type integer not null,queue integer not null,due integer not null,ivl integer not null,factor integer not null,reps integer not null,lapses integer not null,left integer not null,odue integer not null,odid integer not null,flags integer not null,data text not null);",
    "CREATE TABLE revlog (id integer primary key,cid integer not null,usn integer not null,ease integer not null,ivl integer not null,lastIvl integer not null,factor integer not null,time integer not null,type integer not null);",
    "CREATE TABLE graves (usn integer not null,oid integer not null,type integer not null);",
    "ANALYZE sqlite_master;",
    `INSERT INTO "sqlite_stat1" VALUES('col',NULL,'1');`,
    "CREATE INDEX ix_notes_usn on notes (usn);",
    "CREATE INDEX ix_cards_usn on cards (usn);",
    "CREATE INDEX ix_revlog_usn on revlog (usn);",
    "CREATE INDEX ix_cards_nid on cards (nid);",
    "CREATE INDEX ix_cards_sched on cards (did, queue, due);",
    "CREATE INDEX ix_revlog_cid on revlog (cid);",
    "CREATE INDEX ix_notes_csum on notes (csum);",
    "COMMIT;",
  ].join("\n");
}
function escapeJson(json) {
  return json.replace(/'/g, "''");
}
var SEPARATOR = "";

// src/core/generator.ts
var Exporter = ankiPkg.Exporter || ankiPkg.default?.Exporter || ankiPkg;
async function generateApkg(
  items,
  outputFilenameOrParser = "ankideck.apkg",
  legacyDeckName,
  legacyOutputFilename,
) {
  let itemList;
  let outputFilename;
  if (items && "cards" in items && typeof outputFilenameOrParser === "object") {
    itemList = [
      {
        parsedResult: items,
        parser: outputFilenameOrParser,
        deckName: legacyDeckName || "Default",
      },
    ];
    outputFilename = legacyOutputFilename || "ankideck.apkg";
  } else {
    itemList = Array.isArray(items) ? items : [items];
    outputFilename =
      typeof outputFilenameOrParser === "string" ? outputFilenameOrParser : "ankideck.apkg";
  }
  const req = createRequire(import.meta.url);
  const apkgPath = req.resolve("anki-apkg-export");
  const ankiRequire = createRequire(apkgPath);
  const sql = ankiRequire("sql.js/js/sql-memory-growth.js");
  if (!Exporter.prototype._patched) {
    Exporter.prototype._patched = true;
    Exporter.prototype._update = function (query, obj) {
      this.db.run(query, obj);
    };
    Exporter.prototype._getId = function (table, col, ts) {
      const query = `SELECT ${col} from ${table} WHERE ${col} >= :ts ORDER BY ${col} DESC LIMIT 1`;
      const stmt = this.db.prepare(query);
      const rowObj = stmt.getAsObject({ ":ts": ts });
      stmt.free();
      return rowObj[col] ? +rowObj[col] + 1 : ts;
    };
    Exporter.prototype._getNoteId = function (guid, ts) {
      const query = "SELECT id from notes WHERE guid = :guid ORDER BY id DESC LIMIT 1";
      const stmt = this.db.prepare(query);
      const rowObj = stmt.getAsObject({ ":guid": guid });
      stmt.free();
      return rowObj.id || this._getId("notes", "id", ts);
    };
    Exporter.prototype._getCardId = function (note_id, ts) {
      const query = "SELECT id from cards WHERE nid = :note_id ORDER BY id DESC LIMIT 1";
      const stmt = this.db.prepare(query);
      const rowObj = stmt.getAsObject({ ":note_id": note_id });
      stmt.free();
      return rowObj.id || this._getId("cards", "id", ts);
    };
  }
  if (itemList.length === 0) {
    throw new Error("No input items provided for generateApkg.");
  }
  const primaryItem = itemList[0];
  const primaryTemplateName = primaryItem.parser.getTemplateName();
  const primaryFieldNames = primaryItem.parser.getFieldNames();
  const frontHtml = loadFrontHtml(primaryTemplateName);
  const backHtml = loadBackHtml(primaryTemplateName);
  const css = loadCss(primaryTemplateName);
  const template = createAnkiTemplate(frontHtml, backHtml, css, primaryFieldNames);
  const topLevelDeckName = primaryItem.deckName.includes("::")
    ? primaryItem.deckName.split("::")[0]
    : primaryItem.deckName;
  const apkg = new Exporter(topLevelDeckName, { template, sql });
  const deckIdMap = /* @__PURE__ */ new Map();
  deckIdMap.set(topLevelDeckName, apkg.topDeckId);
  const getOrCreateDeckId = (fullDeckName) => {
    if (deckIdMap.has(fullDeckName)) {
      return deckIdMap.get(fullDeckName);
    }
    const db = apkg.db;
    const decksStr = apkg._getFirstVal("select decks from col");
    const now = Date.now();
    const newDeckId = apkg._getId("cards", "did", now);
    const baseDeck = decksStr[apkg.topDeckId + ""] || Object.values(decksStr)[0];
    const newDeck = JSON.parse(JSON.stringify(baseDeck));
    newDeck.name = fullDeckName;
    newDeck.id = newDeckId;
    decksStr[newDeckId + ""] = newDeck;
    apkg._update("update col set decks=:decks where id=1", {
      ":decks": JSON.stringify(decksStr),
    });
    deckIdMap.set(fullDeckName, newDeckId);
    return newDeckId;
  };
  for (const item of itemList) {
    const fieldNames = item.parser.getFieldNames();
    const targetDeckId = getOrCreateDeckId(item.deckName);
    for (const file of item.parsedResult.media) {
      apkg.addMedia(file.filename, file.buffer);
    }
    const originalTopDeckId = apkg.topDeckId;
    apkg.topDeckId = targetDeckId;
    for (const card of item.parsedResult.cards) {
      const frontFieldName = fieldNames[0];
      const frontValue = card.fields[frontFieldName] ?? card.frontKeyField;
      const backValues = fieldNames.slice(1).map((name) => card.fields[name] ?? "");
      const back = backValues.join(SEPARATOR);
      apkg.addCard(frontValue, back);
    }
    apkg.topDeckId = originalTopDeckId;
  }
  console.log("Packing apkg file...");
  try {
    const zip = await apkg.save();
    const finalPath = path9.isAbsolute(outputFilename)
      ? outputFilename
      : path9.join(ROOT, outputFilename);
    fs9.writeFileSync(finalPath, zip);
    console.log(`Success! Exported ${path9.basename(finalPath)}`);
  } catch (err) {
    console.error("Error packing apkg:", err);
    throw err;
  }
}

// src/core/unpacker.ts
import fs10 from "node:fs";
import path10 from "node:path";
import os from "node:os";
import cp from "node:child_process";
import zlib from "node:zlib";
import { createRequire as createRequire2 } from "node:module";
async function unpackApkg(apkgPath, outputDir) {
  const absoluteApkgPath = path10.isAbsolute(apkgPath)
    ? path10.normalize(apkgPath)
    : path10.resolve(process.cwd(), apkgPath);
  const absoluteOutputDir = path10.isAbsolute(outputDir)
    ? path10.normalize(outputDir)
    : path10.resolve(process.cwd(), outputDir);
  if (!fs10.existsSync(absoluteApkgPath)) {
    throw new Error(`APKG file not found: ${absoluteApkgPath}`);
  }
  fs10.mkdirSync(absoluteOutputDir, { recursive: true });
  const tmpDir = fs10.mkdtempSync(path10.join(os.tmpdir(), "anki-unpack-"));
  try {
    console.log(`Unpacking APKG archive: ${absoluteApkgPath}`);
    cp.execSync(`unzip -o "${absoluteApkgPath}" -d "${tmpDir}"`, { stdio: "ignore" });
    let dbName = "collection.anki21";
    if (!fs10.existsSync(path10.join(tmpDir, dbName))) {
      dbName = "collection.anki2";
    }
    const dbPath = path10.join(tmpDir, dbName);
    if (!fs10.existsSync(dbPath)) {
      throw new Error("Invalid .apkg: SQLite database collection file not found inside package.");
    }
    const workspaceRequire = createRequire2(import.meta.url);
    const apkgPackagePath = workspaceRequire.resolve("anki-apkg-export");
    const ankiRequire = createRequire2(apkgPackagePath);
    const sql = ankiRequire("sql.js/js/sql-memory-growth.js");
    let dbBuffer = fs10.readFileSync(dbPath);
    if (dbBuffer.length > 2 && dbBuffer[0] === 31 && dbBuffer[1] === 139) {
      dbBuffer = zlib.gunzipSync(dbBuffer);
    }
    const db = new sql.Database(dbBuffer);
    const colResult = db.exec("SELECT models FROM col;");
    if (!colResult.length || !colResult[0].values.length) {
      throw new Error("Invalid database: col table or models not found.");
    }
    const modelsJson = colResult[0].values[0][0];
    const models = JSON.parse(modelsJson);
    const notesResult = db.exec("SELECT id, mid, flds, tags FROM notes;");
    const cardsList = [];
    if (notesResult.length && notesResult[0].values.length) {
      const columns = notesResult[0].columns;
      const values = notesResult[0].values;
      const idIdx = columns.indexOf("id");
      const midIdx = columns.indexOf("mid");
      const fldsIdx = columns.indexOf("flds");
      const tagsIdx = columns.indexOf("tags");
      for (const row of values) {
        const id = row[idIdx];
        const mid = String(row[midIdx]);
        const flds = row[fldsIdx];
        const tagsRaw = row[tagsIdx];
        const tags = tagsRaw ? tagsRaw.trim().split(/\s+/).filter(Boolean) : [];
        const model = models[mid];
        const modelName = model ? model.name : "Unknown Model";
        const modelFields = model ? model.flds : [];
        const fieldValues = flds.split("");
        const fields = {};
        if (fieldValues.length === modelFields.length + 1) {
          modelFields.forEach((field, index) => {
            fields[field.name] = fieldValues[index + 1] || "";
          });
        } else {
          modelFields.forEach((field, index) => {
            fields[field.name] = fieldValues[index] || "";
          });
        }
        cardsList.push({
          id,
          modelName,
          fields,
          tags,
        });
      }
    }
    const outputJsonPath = path10.join(absoluteOutputDir, "cards.json");
    fs10.writeFileSync(outputJsonPath, JSON.stringify(cardsList, null, 2), "utf-8");
    console.log(`Exported card metadata to: ${outputJsonPath}`);
    const mediaMapPath = path10.join(tmpDir, "media");
    if (fs10.existsSync(mediaMapPath)) {
      let mediaMap = {};
      try {
        mediaMap = JSON.parse(fs10.readFileSync(mediaMapPath, "utf-8"));
      } catch (e) {
        console.warn("Failed to parse media dictionary:", e);
      }
      let copiedCount = 0;
      for (const [obfuscatedName, originalName] of Object.entries(mediaMap)) {
        const sourceFile = path10.join(tmpDir, obfuscatedName);
        if (fs10.existsSync(sourceFile)) {
          const destFile = path10.join(absoluteOutputDir, originalName);
          fs10.copyFileSync(sourceFile, destFile);
          copiedCount++;
        }
      }
      if (copiedCount > 0) {
        console.log(`Unpacked ${copiedCount} media assets to: ${absoluteOutputDir}`);
      }
    }
  } finally {
    try {
      fs10.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

// src/parsers/mcq-shuffle.ts
var MCQShuffleParser = class extends MCQParser {
  getTemplateName() {
    return "mcq-shuffle";
  }
};

// src/parsers/jp_vocab.ts
import fs11 from "node:fs";
import path11 from "node:path";
var FIELD_NAMES7 = [
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
];
var JpVocabParser = class extends BaseParser {
  getFieldNames() {
    return FIELD_NAMES7;
  }
  getTemplateName() {
    return "jp_vocab";
  }
  async parse(rawJson) {
    let cleanRaw = rawJson.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    const items = JSON.parse(cleanRaw);
    const cards = [];
    const media = [];
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
      let wordAudioBuffer = null;
      let hasWordAudio = false;
      if (vocab.kana_reading || vocab.kanji_expression) {
        const textToSpeak = vocab.kana_reading || vocab.kanji_expression;
        hasWordAudio = await downloadAudio(textToSpeak, wordAudioFilename, "ja");
        if (hasWordAudio) {
          const audioPath = path11.join(MEDIA_DIR, wordAudioFilename);
          if (fs11.existsSync(audioPath)) {
            wordAudioBuffer = fs11.readFileSync(audioPath);
          }
        }
      }
      let sentenceAudioBuffer = null;
      let hasSentenceAudio = false;
      if (ctx.sentence_jp) {
        hasSentenceAudio = await downloadAudio(ctx.sentence_jp, sentenceAudioFilename, "ja");
        if (hasSentenceAudio) {
          const audioPath = path11.join(MEDIA_DIR, sentenceAudioFilename);
          if (fs11.existsSync(audioPath)) {
            sentenceAudioBuffer = fs11.readFileSync(audioPath);
          }
        }
      }
      let imageHtml = "";
      let imageFilename = "";
      let imageBuffer = null;
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
            const imgPath = path11.join(MEDIA_DIR, imageFilename);
            if (fs11.existsSync(imgPath)) {
              imageBuffer = fs11.readFileSync(imgPath);
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
};

// src/index.ts
var VALID_STRATEGIES = [
  "vocab",
  "grammar",
  "mcq",
  "mcq-shuffle",
  "mcq-listening",
  "mcq_listening",
  "basic",
  "jp_vocab",
  "jp_grammar",
];
var PROMPT_MAPPING = {
  "anki-flashcard-english-vocab": "prompt-anki-flashcard-english-vocab.md",
  "mcq-creation": "prompt-mcq-creation.md",
};
function parseArgs() {
  const args = process.argv.slice(2);
  const hasType = args.includes("--type");
  const hasExport = args.includes("--export");
  const hasPrompt = args.includes("--prompt");
  const hasAutocomplete = args.includes("--autocomplete");
  return { args, hasType, hasExport, hasPrompt, hasAutocomplete };
}
function printUsageAndExit() {
  console.error("Terminal Usage Error:");
  console.error("  Compilation Mode:");
  console.error(
    "    node src/index.js --type <vocab | grammar | mcq | mcq-shuffle | mcq-listening | basic | jp_vocab | jp_grammar> <path_to_input_json> [path_to_input_json_2 ...]",
  );
  console.error("  Deconstruction Mode:");
  console.error("    node src/index.js --export <path_to_target_apkg> <path_to_output_directory>");
  console.error("  Prompt Retrieval Mode:");
  console.error("    node src/index.js --prompt");
  console.error("    node src/index.js --prompt <name>");
  console.error("  Autocomplete Output Mode:");
  console.error("    node src/index.js --autocomplete");
  process.exit(1);
}
function resolveAbsolutePath(inputPath) {
  return path12.isAbsolute(inputPath)
    ? path12.normalize(inputPath)
    : path12.resolve(process.cwd(), inputPath);
}
function resolveParser(strategy) {
  const parsers = {
    vocab: () => new VocabParser(),
    grammar: () => new GrammarParser(),
    mcq: () => new MCQParser(),
    "mcq-shuffle": () => new MCQShuffleParser(),
    "mcq-listening": () => new MCQListeningParser(),
    mcq_listening: () => new MCQListeningParser(),
    basic: () => new BasicParser(),
    jp_vocab: () => new JpVocabParser(),
    jp_grammar: () => new JpGrammarParser(),
  };
  return parsers[strategy]();
}
async function runCompile(args) {
  const typeIdx = args.indexOf("--type");
  const strategy = args[typeIdx + 1]?.toLowerCase();
  const rawInputPaths = [];
  for (let i = typeIdx + 2; i < args.length; i++) {
    if (args[i].startsWith("-")) break;
    rawInputPaths.push(args[i]);
  }
  if (!strategy || !VALID_STRATEGIES.includes(strategy)) {
    console.error(
      "Error: Invalid or missing type. Must be one of: vocab, grammar, mcq, mcq-shuffle, basic, jp_vocab, jp_grammar",
    );
    process.exit(1);
  }
  if (rawInputPaths.length === 0) {
    console.error("Error: Missing path to input JSON file(s).");
    process.exit(1);
  }
  const firstInputPath = resolveAbsolutePath(rawInputPaths[0]);
  const inputDir = path12.dirname(firstInputPath);
  const firstBaseName = path12.basename(firstInputPath, path12.extname(firstInputPath));
  const isMultiple = rawInputPaths.length > 1;
  const firstNormalized = path12.normalize(rawInputPaths[0]);
  const firstPathParts = firstNormalized.split(path12.sep).filter(Boolean);
  const hasParentFolder = firstPathParts.length >= 2;
  const parentFolder = hasParentFolder ? firstPathParts[firstPathParts.length - 2] : null;
  const allShareSameParentFolder =
    hasParentFolder &&
    rawInputPaths.every((p) => {
      const parts = path12.normalize(p).split(path12.sep).filter(Boolean);
      return parts.length >= 2 && parts[parts.length - 2] === parentFolder;
    });
  let masterOutputName = firstBaseName;
  if (isMultiple) {
    if (allShareSameParentFolder && parentFolder) {
      masterOutputName = parentFolder;
    } else {
      masterOutputName = `${firstBaseName}_combined`;
    }
  }
  const items = [];
  for (const inputPath of rawInputPaths) {
    const absoluteInputPath = resolveAbsolutePath(inputPath);
    if (!fs12.existsSync(absoluteInputPath)) {
      console.error(`Input file not found: ${absoluteInputPath}`);
      process.exit(1);
    }
    const raw = fs12.readFileSync(absoluteInputPath, "utf-8");
    const data = parseJsonInput(raw);
    validateJsonStructure(data, strategy);
    const parser = resolveParser(strategy);
    console.log(
      `Compiling payload [${path12.basename(absoluteInputPath)}] with strategy: ${strategy}`,
    );
    const parsedResult = await parser.parse(raw);
    const fileBaseName = path12.basename(absoluteInputPath, path12.extname(absoluteInputPath));
    const normalizedPath = path12.normalize(inputPath);
    const pathParts = normalizedPath.split(path12.sep).filter(Boolean);
    let deckName = fileBaseName;
    if (pathParts.length >= 2) {
      const folderName = pathParts[pathParts.length - 2];
      deckName = `${folderName}::${fileBaseName}`;
    }
    items.push({
      parsedResult,
      parser,
      deckName,
    });
  }
  const outputPath = path12.join(inputDir, `${masterOutputName}.apkg`);
  await generateApkg(items, outputPath);
}
async function runExport(args) {
  const exportIdx = args.indexOf("--export");
  const apkgPath = args[exportIdx + 1];
  const outputDir = args[exportIdx + 2];
  if (!apkgPath) {
    console.error("Error: Missing target APKG package path.");
    process.exit(1);
  }
  if (!outputDir) {
    console.error("Error: Missing destination directory path.");
    process.exit(1);
  }
  await unpackApkg(apkgPath, outputDir);
}
async function runPrompt(args) {
  const promptIdx = args.indexOf("--prompt");
  const name = args[promptIdx + 1];
  const assetsDir = path12.join(ROOT, "assets");
  if (!name || name.startsWith("-")) {
    if (!fs12.existsSync(assetsDir)) {
      console.error("Error: assets directory not found.");
      process.exit(1);
    }
    const files = fs12.readdirSync(assetsDir).filter((file) => file.endsWith(".md"));
    const list = [];
    for (const file of files) {
      let shortName = file.replace(/\.md$/, "");
      if (shortName.startsWith("prompt-")) {
        shortName = shortName.slice(7);
      }
      const stats = fs12.statSync(path12.join(assetsDir, file));
      const sizeKb = (stats.size / 1024).toFixed(2);
      list.push(`${shortName} (${sizeKb} KB)`);
    }
    console.log(list.join("\n"));
  } else {
    const filename = PROMPT_MAPPING[name] || `prompt-${name}.md`;
    const fullPath = path12.join(assetsDir, filename);
    if (!fs12.existsSync(fullPath)) {
      console.error(`Error: Prompt template '${name}' not found.`);
      console.error("Available options:");
      const files = fs12.existsSync(assetsDir)
        ? fs12.readdirSync(assetsDir).filter((f) => f.endsWith(".md"))
        : [];
      for (const file of files) {
        let shortName = file.replace(/\.md$/, "");
        if (shortName.startsWith("prompt-")) {
          shortName = shortName.slice(7);
        }
        console.error(`  - ${shortName}`);
      }
      process.exit(1);
    }
    const content = fs12.readFileSync(fullPath, "utf-8");
    process.stdout.write(content);
  }
}
async function runAutocomplete() {
  const completionPath = path12.join(ROOT, "completions", "_anki-tool");
  if (!fs12.existsSync(completionPath)) {
    console.error(`Error: Completion script not found at ${completionPath}`);
    process.exit(1);
  }
  try {
    const content = fs12.readFileSync(completionPath, "utf-8");
    process.stdout.write(content);
  } catch (err) {
    console.error(`Error reading completion script: ${err?.message || err}`);
    process.exit(1);
  }
}
async function main() {
  const { args, hasType, hasExport, hasPrompt, hasAutocomplete } = parseArgs();
  const activeFlagsCount = [hasType, hasExport, hasPrompt, hasAutocomplete].filter(Boolean).length;
  if (activeFlagsCount > 1) {
    console.error(
      "Error: --type, --export, --prompt, and --autocomplete are mutually exclusive and only one may be active per invocation.",
    );
    process.exit(1);
  }
  if (activeFlagsCount === 0) printUsageAndExit();
  if (hasType) await runCompile(args);
  if (hasExport) await runExport(args);
  if (hasPrompt) await runPrompt(args);
  if (hasAutocomplete) await runAutocomplete();
}
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
