import { BaseParser } from "./base.js";
import type { MCQItem, ParsedResult, ParsedCard } from "../types/index.js";
import { convertMarkdownToHtml } from "../utils/helpers.js";

const FIELD_NAMES = ["Question", "OptionsB64", "CorrectAnswersB64", "Explanation"] as const;

export class MCQParser extends BaseParser {
  getFieldNames(): readonly string[] {
    return FIELD_NAMES;
  }

  getTemplateName(): string {
    return "mcq";
  }

  async parse(rawJson: string): Promise<ParsedResult> {
    let cleanRaw = rawJson.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    const mcqList: MCQItem[] = JSON.parse(cleanRaw);
    const cards: ParsedCard[] = [];

    console.log(`MCQParser: Processing ${mcqList.length} items...`);

    for (const item of mcqList) {
      // Format options into Base64 JSON array for interactive templates
      const optionsArray = Object.entries(item.options).map(([key, value]) => ({
        key: key.trim().toLowerCase(),
        label: key.trim().toUpperCase(),
        text: value.trim(),
      }));
      const optionsB64 = Buffer.from(JSON.stringify(optionsArray)).toString("base64");

      // Format correct answers into Base64 JSON array (handles single or comma-separated keys)
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
}
