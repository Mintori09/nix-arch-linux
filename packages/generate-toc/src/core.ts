import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { Heading, slugify } from "./utils.js";
import { extractHeadings as extractMd } from "./parsers/markdown.js";
import { extractHeadings as extractHtml } from "./parsers/html.js";
import { extractHeadings as extractDocx } from "./parsers/docx.js";

export async function generateToc(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();

  let headings: Heading[];

  switch (ext) {
    case ".md": {
      headings = extractMd(readFileSync(filePath, "utf-8"));
      break;
    }
    case ".html":
    case ".htm": {
      headings = extractHtml(filePath);
      break;
    }
    case ".docx": {
      headings = await extractDocx(filePath);
      break;
    }
    default:
      throw new Error(
        `Unsupported format "${ext}". Only .md, .docx, and .html are supported.`,
      );
  }

  if (headings.length === 0) return "";

  return headings
    .map(({ level, title }) => {
      const indent = "  ".repeat(level - 1);
      const slug = slugify(title);
      return `${indent}- [${title}](#${slug})`;
    })
    .join("\n");
}
