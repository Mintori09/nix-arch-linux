import { BaseParser } from "./base.js";
import type { ParsedResult, ParsedCard, BasicItem } from "../types/index.js";
import { convertMarkdownToHtml } from "../utils/helpers.js";

const FIELD_NAMES = ["Front", "Back"] as const;

export class BasicParser extends BaseParser {
  getFieldNames(): readonly string[] {
    return FIELD_NAMES;
  }

  getTemplateName(): string {
    return "basic";
  }

  async parse(rawJson: string): Promise<ParsedResult> {
    let cleanRaw = rawJson.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    const basicList: BasicItem[] = JSON.parse(cleanRaw);
    const cards: ParsedCard[] = [];

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
}
