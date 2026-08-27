import { readFileSync } from "node:fs";
import mammoth from "mammoth";
import * as cheerio from "cheerio";
import { Heading } from "../utils.js";

export async function extractHeadings(filePath: string): Promise<Heading[]> {
  const buffer = readFileSync(filePath);
  const result = await mammoth.convertToHtml({ buffer });
  const $ = cheerio.load(result.value);
  const headings: Heading[] = [];

  $("h1, h2, h3, h4, h5, h6").each((_i, el) => {
    const tagName = el.tagName.toLowerCase();
    const level = parseInt(tagName[1], 10);
    const title = $(el).text().trim();
    if (title) {
      headings.push({ level, title });
    }
  });

  return headings;
}
