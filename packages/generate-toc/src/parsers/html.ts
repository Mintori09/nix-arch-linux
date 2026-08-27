import { readFileSync } from "node:fs";
import * as cheerio from "cheerio";
import { Heading } from "../utils.js";

export function extractHeadings(filePath: string): Heading[] {
  const html = readFileSync(filePath, "utf-8");
  const $ = cheerio.load(html);
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
