import { VocabParser } from "../parsers/vocab.js";
import { GrammarParser } from "../parsers/grammar.js";
import { MCQParser } from "../parsers/mcq.js";
import { MCQListeningParser } from "../parsers/mcq-listening.js";
import { BasicParser } from "../parsers/basic.js";
import { JpGrammarParser } from "../parsers/jp_grammar.js";
import type { BaseParser } from "../parsers/base.js";

/**
 * Strips markdown code block formatting and parses JSON string safely with detailed error context.
 */
export function parseJsonInput(raw: string): any {
  let cleanRaw = raw.trim();
  if (cleanRaw.startsWith("```")) {
    cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(cleanRaw);
  } catch (error: any) {
    let line = 1;
    let column = 1;
    let snippet = "";

    const matchPos = error?.message?.match(/position\s+(\d+)/i);
    if (matchPos) {
      const pos = parseInt(matchPos[1], 10);
      const lines = cleanRaw.slice(0, pos).split("\n");
      line = lines.length;
      column = lines[lines.length - 1].length + 1;
      const allLines = cleanRaw.split("\n");
      const errLine = allLines[line - 1] || "";
      const pointer = " ".repeat(Math.max(0, column - 1)) + "^";
      snippet = `\n  ${line} | ${errLine}\n    | ${pointer}`;
    } else {
      const matchLine = error?.message?.match(/line\s+(\d+)\s+column\s+(\d+)/i);
      if (matchLine) {
        line = parseInt(matchLine[1], 10);
        column = parseInt(matchLine[2], 10);
        const allLines = cleanRaw.split("\n");
        const errLine = allLines[line - 1] || "";
        const pointer = " ".repeat(Math.max(0, column - 1)) + "^";
        snippet = `\n  ${line} | ${errLine}\n    | ${pointer}`;
      }
    }

    const details = `JSON Syntax Error at Line ${line}, Column ${column}: ${error?.message || "Invalid JSON"}${snippet}`;
    throw new Error(details);
  }
}

type FieldType = "string" | "object";

interface FieldSchema {
  name: string;
  type: FieldType;
  optional?: boolean;
}

const SCHEMAS: Record<string, FieldSchema[]> = {
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

function printSchema(strategy: string, schema: FieldSchema[]): void {
  console.error('  Required fields for type "' + strategy + '":');
  for (const f of schema) {
    const tag = f.optional ? "  (optional)" : "  (required)";
    console.error("    " + tag + ' "' + f.name + '" (' + f.type + ")");
  }
}

export function validateJsonStructure(data: any, strategy: string): void {
  const schema = SCHEMAS[strategy];
  if (!schema) return;

  if (!Array.isArray(data)) {
    const msg = [
      "",
      "=== JSON Structure Error ===",
      "",
      "  Expected: A JSON array of objects at the top level.",
      "  Got:      " + (data === null ? "null" : typeof data),
      "",
      "  When using --type " + strategy + ", your JSON file must contain",
      "  an array of items wrapped in [ ]. Currently it contains a",
      "  single " + (data === null ? "null" : typeof data) + " instead.",
      "",
      "  Correct format:",
      '    [ { "field1": "...", "field2": "..." } ]',
    ].join("\n");
    console.error(msg);
    throw new Error(msg);
  }

  if (data.length === 0) {
    const msg = [
      "",
      "=== JSON Structure Error ===",
      "",
      "  The JSON array is empty ([]).",
      "  There must be at least one item to compile.",
    ].join("\n");
    console.error(msg);
    throw new Error(msg);
  }

  const requiredFields = schema.filter((f) => !f.optional);

  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      const typeName = item === null ? "null" : Array.isArray(item) ? "array" : typeof item;
      const msg = [
        "",
        "=== JSON Structure Error ===",
        "",
        "  Card #" + (i + 1) + " (type: " + strategy + ")",
        "  Reason: Item is not an object. Got: " + typeName,
        "",
        "  Each item in the array must be a JSON object ( { } ).",
      ].join("\n");
      console.error(msg);
      throw new Error(msg);
    }

    const missingFields = requiredFields.filter((f) => !(f.name in item)).map((f) => f.name);
    if (missingFields.length > 0) {
      const msgLines = [
        "",
        "=== JSON Structure Error ===",
        "",
        "  Card #" + (i + 1) + " (type: " + strategy + ")",
        "  Reason: Missing required field(s): " + missingFields.map((f) => `"${f}"`).join(", "),
      ];
      const itemKeys = Object.keys(item);
      if (itemKeys.length === 0) {
        msgLines.push("  Fields present: (none — empty object {})");
      } else {
        msgLines.push("  Fields present: " + itemKeys.map((k) => `"${k}"`).join(", "));
        for (const k of itemKeys) {
          const match = requiredFields.find((f) => {
            const dist = levenshtein(k.toLowerCase(), f.name.toLowerCase());
            return dist > 0 && dist <= 2;
          });
          if (match) {
            msgLines.push('  (Did you mean "' + match.name + '" instead of "' + k + '"?)');
          }
        }
      }
      const msg = msgLines.join("\n");
      console.error(msg);
      throw new Error(msg);
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
        const msg = [
          "",
          "=== JSON Structure Error ===",
          "",
          "  Card #" + (i + 1) + " (type: " + strategy + ")",
          '  Field: "' + field.name + '"',
          "  Reason: Wrong type. Expected " + field.type + ", got " + actualType + ".",
        ].join("\n");
        console.error(msg);
        throw new Error(msg);
      }
    }
  }
}

function levenshtein(a: string, b: string): number {
  const m: number[][] = [];
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

/**
 * Detects the correct parser based on the schema of the first item in the array.
 */
export function getParserForData(data: any[]): BaseParser {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("JSON data must be a non-empty array of items.");
  }
  const firstItem = data[0];
  if (
    "grammar" in firstItem &&
    typeof firstItem.grammar === "object" &&
    "pattern" in firstItem.grammar
  ) {
    console.log("Detected Japanese Grammar format schema.");
    return new JpGrammarParser();
  } else if ("word" in firstItem) {
    console.log("Detected Vocab format schema.");
    return new VocabParser();
  } else if ("pattern" in firstItem) {
    console.log("Detected Grammar format schema.");
    return new GrammarParser();
  } else if (
    "options" in firstItem &&
    ("audio" in firstItem || "audio_text" in firstItem || "image" in firstItem)
  ) {
    console.log("Detected MCQ Listening format schema.");
    return new MCQListeningParser();
  } else if ("question" in firstItem) {
    console.log("Detected MCQ format schema.");
    return new MCQParser();
  } else if ("front" in firstItem && "back" in firstItem) {
    console.log("Detected Basic format schema.");
    return new BasicParser();
  }
  throw new Error("Unknown JSON format. Could not match with Vocab, Grammar, MCQ or Basic schema.");
}

/**
 * Converts markdown-style code fences and inline backticks into HTML elements
 * to display correctly inside Anki cards.
 */
export function convertMarkdownToHtml(text: string): string {
  if (!text) return "";

  const codeBlocks: string[] = [];

  // 1. Extract block code fences and save them to a temporary list
  const blockRegex = /```(\w*)\r?\n([\s\S]*?)\r?\n```/g;
  let formatted = text.replace(blockRegex, (match, lang, code) => {
    const escapedCode = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const langClass = lang ? ` class="language-${lang}"` : "";
    const placeholder = `:::CODEBLOCK${codeBlocks.length}:::`;
    codeBlocks.push(`<pre><code${langClass}>${escapedCode}</code></pre>`);
    return placeholder;
  });

  // 2. Format inline markdown formatting (bold, italic, strikethrough)
  // Bold + Italic (***text*** or ___text___)
  formatted = formatted.replace(/(\*\*\*|___)(.*?)\1/g, "<strong><em>$2</em></strong>");
  // Bold (**text** or __text__)
  formatted = formatted.replace(/(\*\*|__)(.*?)\1/g, "<strong>$2</strong>");
  // Italic (*text* or _text_)
  formatted = formatted.replace(/(\*|_)(.*?)\1/g, "<em>$2</em>");
  // Strikethrough (~~text~~)
  formatted = formatted.replace(/~~(.*?)~~/g, "<del>$1</del>");

  // Inline code (`text`)
  formatted = formatted.replace(/`([^`]+)`/g, (match, code) => {
    const escapedInline = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<code>${escapedInline}</code>`;
  });

  // 3. Convert remaining newlines to <br> to preserve layouts in Anki
  formatted = formatted.replace(/\r?\n/g, "<br>");

  // 4. Restore the code blocks
  codeBlocks.forEach((html, index) => {
    formatted = formatted.replace(`:::CODEBLOCK${index}:::`, html);
  });

  return formatted;
}

/**
 * Converts Japanese bracket furigana notation (e.g. 閉[し]める) to Anki HTML ruby markup (<ruby>閉<rt>し</rt></ruby>める).
 */
export function convertFuriganaToHtml(text: string): string {
  if (!text) return "";
  return text.replace(/([一-龯ヶヶ]+)\[([^\]]+)\]/g, "<ruby>$1<rt>$2</rt></ruby>");
}

/**
 * Runs a list of async task functions with a specified concurrency limit.
 */
export async function limitConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  const executing: Promise<void>[] = [];

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
