import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { pathExists } from "../utils.ts";
import { runCommand } from "../core/command.ts";
import { pandoc, type ToolConverter, type ConvertContext } from "./index.ts";

export type EpubMetadata = {
  title?: string;
  author?: string;
  language?: string;
  publisher?: string;
  isbn?: string;
  description?: string;
  pubdate?: string;
};

function extractTag(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

function extractAttr(
  xml: string,
  tagName: string,
  attr: string,
): string | null {
  const regex = new RegExp(`<${tagName}[^>]*\\s${attr}=["']([^"']*)["']`, "i");
  const match = regex.exec(xml);
  return match ? match[1] : null;
}

export function parseOpfMetadata(opfXml: string): EpubMetadata {
  const meta: EpubMetadata = {};

  const title = extractTag(opfXml, "dc:title");
  if (title) meta.title = title;

  const creator = extractTag(opfXml, "dc:creator");
  if (creator) meta.author = creator;

  const language = extractTag(opfXml, "dc:language");
  if (language) meta.language = language;

  const publisher = extractTag(opfXml, "dc:publisher");
  if (publisher) meta.publisher = publisher;

  const description = extractTag(opfXml, "dc:description");
  if (description) meta.description = description;

  const pubdate = extractTag(opfXml, "dc:date");
  if (pubdate) meta.pubdate = pubdate;

  // Find ISBN: prefer identifier with opf:scheme matching ISBN
  const idRegex = /<dc:identifier[^>]*>([\s\S]*?)<\/dc:identifier>/gi;
  let idMatch: RegExpExecArray | null;
  let firstId: string | null = null;
  while ((idMatch = idRegex.exec(opfXml)) !== null) {
    const fullTag = idMatch[0];
    const value = idMatch[1].trim();
    const scheme = extractAttr(fullTag, "dc:identifier", "opf:scheme");
    if (!firstId) firstId = value;
    if (scheme && /isbn/i.test(scheme)) {
      meta.isbn = value;
      break;
    }
  }
  if (!meta.isbn && firstId) meta.isbn = firstId;

  return meta;
}

export function findCoverRef(
  opfXml: string,
  opfDir: string,
): { href: string; ext: string } | null {
  const coverMatch =
    /<meta\s+name=["']cover["']\s+content=["']([^"']+)["']/.exec(opfXml);
  if (!coverMatch) return null;

  const coverId = coverMatch[1];
  const itemRegex = new RegExp(
    `<item[^>]*\\sid=["']${coverId}["'][^>]*href=["']([^"']+)["'][^>]*media-type=["']image/([^"']+)["']`,
  );
  const itemMatch = itemRegex.exec(opfXml);
  if (!itemMatch) return null;

  const href = itemMatch[1];
  const rawExt = itemMatch[2];
  const ext = rawExt === "jpeg" ? "jpg" : rawExt;

  const zipHref = opfDir ? `${opfDir}/${href}` : href;
  return { href: zipHref, ext };
}

export function mdToPdf(): ReturnType<typeof pandoc> {
  return {
    tool: "pandoc" as const,
    convert: async (input, output, context) => {
      const defaultCssPath = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "style.css",
      );
      const extraParams = ["--pdf-engine=weasyprint"];
      if (await pathExists(defaultCssPath))
        extraParams.push("--css", defaultCssPath);
      context.flags.pageSize ??= "a4";
      await pandoc({
        from: "markdown",
        to: "pdf",
        params: [
          ...extraParams,
          "--highlight-style",
          "tango",
          "-V",
          "geometry:margin=2cm",
        ],
      }).convert(input, output, context);
    },
  };
}

export function epubToPdf(): ReturnType<typeof pandoc> {
  return {
    tool: "pandoc" as const,
    convert: async (input, output, context) => {
      const extraParams = ["--pdf-engine=weasyprint"];
      context.flags.pageSize ??= "a4";
      await pandoc({
        from: "epub",
        to: "pdf",
        params: [
          ...extraParams,
          "--highlight-style",
          "tango",
          "-V",
          "geometry:margin=2cm",
        ],
      }).convert(input, output, context);
    },
  };
}

export function mdToHtml(): ReturnType<typeof pandoc> {
  return {
    tool: "pandoc" as const,
    convert: async (input, output, context) => {
      const defaultCssPath = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "style.html.css",
      );
      const extraParams: string[] = ["-s"];
      if (!context.flags.style && (await pathExists(defaultCssPath)))
        extraParams.push("--css", defaultCssPath);
      await pandoc({
        from: "markdown",
        to: "html",
        params: extraParams,
      }).convert(input, output, context);
    },
  };
}

export function epubToMd(): ToolConverter {
  return {
    tool: "pandoc" as const,
    convert: async (input, output, context) => {
      const tmpDir = await mkdtemp(path.join(tmpdir(), "cv-epub-"));
      try {
        const outBase = output.replace(/\.[^/.]+$/, "");
        const metadataPath = `${outBase}-metadata.json`;

        // 1. Parse container.xml for OPF path
        let containerXml = "";
        let opfPath = "";
        try {
          containerXml = await runCommand(
            ["unzip", "-p", input, "META-INF/container.xml"],
            { dryRun: context.dryRun, captureStdout: true },
          );
          const opfPathMatch = /<rootfile[^>]*full-path=["']([^"']+)["']/.exec(
            containerXml,
          );
          if (opfPathMatch) opfPath = opfPathMatch[1];
        } catch {
          console.error(
            "Warning: could not parse container.xml, skipping metadata/cover extraction",
          );
        }

        if (opfPath) {
          await processEpubAssets(
            input,
            opfPath,
            metadataPath,
            tmpDir,
            context,
          );
        }

        // 2. Run pandoc conversion
        await pandoc({ from: "epub", to: "markdown" }).convert(
          input,
          output,
          context,
        );
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    },
  };
}

async function processEpubAssets(
  input: string,
  opfPath: string,
  metadataPath: string,
  tmpDir: string,
  context: ConvertContext,
): Promise<void> {
  let opfXml: string;
  try {
    opfXml = await runCommand(["unzip", "-p", input, opfPath], {
      dryRun: context.dryRun,
      captureStdout: true,
    });
  } catch {
    console.error(
      "Warning: could not read OPF file, skipping metadata/cover extraction",
    );
    return;
  }

  if (!opfXml) return;

  // Extract and write metadata
  const metadata = parseOpfMetadata(opfXml);
  const missingFields: string[] = [];
  for (const key of [
    "title",
    "author",
    "language",
    "publisher",
    "isbn",
    "description",
    "pubdate",
  ] as const) {
    if (!metadata[key]) missingFields.push(key);
  }
  if (missingFields.length > 0) {
    console.error(
      `Warning: EPUB metadata missing: ${missingFields.join(", ")}`,
    );
  }
  if (!context.dryRun) {
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  // Extract cover image
  const opfDir = path.dirname(opfPath);
  const coverRef = findCoverRef(opfXml, opfDir);
  if (!coverRef) {
    console.error("Warning: no cover image found in EPUB metadata");
    return;
  }

  try {
    await runCommand(["unzip", "-o", input, "-d", tmpDir, coverRef.href], {
      dryRun: context.dryRun,
    });
    if (!context.dryRun) {
      const extracted = path.join(tmpDir, coverRef.href);
      const outBase = metadataPath.replace(/-metadata\.json$/, "");
      await copyFile(extracted, `${outBase}-cover.${coverRef.ext}`);
    }
  } catch {
    console.error("Warning: could not extract cover image");
  }
}
