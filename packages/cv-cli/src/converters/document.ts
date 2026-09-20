import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile, copyFile, rm, stat, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { pathExists } from "../utils.ts";
import { runCommand } from "../core/command.ts";
import { pandoc, type ToolConverter, type ConvertContext } from "./index.ts";
import { CliError } from "../errors.ts";
import {
  hasRemoteImages,
  preprocessRemoteImages,
} from "./remote-images.ts";

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

export function mdToEpub(): ToolConverter {
  return {
    tool: "pandoc" as const,
    convert: async (input, output, context) => {
      let mdFiles: string[] = [];
      let searchDir: string | null = null;

      if (context.inputs && context.inputs.length > 1) {
        mdFiles = [...context.inputs];
      } else {
        try {
          const st = await stat(input);
          if (st.isDirectory()) {
            searchDir = input;
            const entries = await readdir(input, { withFileTypes: true });
            const collator = new Intl.Collator(undefined, {
              numeric: true,
              sensitivity: "base",
            });
            mdFiles = entries
              .filter(
                (e) =>
                  e.isFile() &&
                  !e.name.startsWith(".") &&
                  (e.name.endsWith(".md") || e.name.endsWith(".markdown")),
              )
              .map((e) => e.name)
              .sort(collator.compare)
              .map((name) => path.join(input, name));
            if (mdFiles.length === 0) {
              throw new CliError(`No markdown files found in directory '${input}'.`);
            }
          } else {
            mdFiles = [input];
          }
        } catch (err: unknown) {
          if (err instanceof CliError) throw err;
          // If stat fails or anything else, fallback to [input]
          mdFiles = [input];
        }
      }

      const dirToScan =
        searchDir ??
        (mdFiles.length > 0 ? path.dirname(mdFiles[0]) : path.dirname(input));

      // 1. Detect metadata file
      let metadataFilePath = context.flags.metadataFile;
      if (!metadataFilePath && dirToScan) {
        for (const metaCandidate of [
          "metadata.json",
          "metadata.yaml",
          "metadata.yml",
        ]) {
          const candidatePath = path.join(dirToScan, metaCandidate);
          if (await pathExists(candidatePath)) {
            metadataFilePath = candidatePath;
            break;
          }
        }
      }

      // Check if metadata has title and cover-image
      let hasTitleInMetadata = false;
      let hasCoverInMetadata = false;
      if (metadataFilePath && (await pathExists(metadataFilePath))) {
        try {
          const content = await readFile(metadataFilePath, "utf-8");
          if (metadataFilePath.endsWith(".json")) {
            const parsed = JSON.parse(content);
            if (parsed.title) hasTitleInMetadata = true;
            if (parsed["cover-image"] || parsed.cover) hasCoverInMetadata = true;
          } else {
            if (/^title\s*:/m.test(content)) hasTitleInMetadata = true;
            if (/^(cover-image|cover)\s*:/m.test(content))
              hasCoverInMetadata = true;
          }
        } catch {
          // ignore parsing error, let pandoc handle or report
        }
      }

      // 2. Detect cover image if not defined in metadata
      let coverImagePath: string | null = null;
      if (!hasCoverInMetadata && dirToScan) {
        for (const ext of ["jpg", "jpeg", "png", "webp"]) {
          const candidate = path.join(dirToScan, `cover.${ext}`);
          if (await pathExists(candidate)) {
            coverImagePath = candidate;
            break;
          }
        }
      }

      let tempDir: string | undefined;
      let effectiveMdFiles = mdFiles;

      if (!context.dryRun) {
        // Preprocess remote images if any file contains them
        const filesWithRemote: { file: string; content: string }[] = [];
        for (const file of mdFiles) {
          try {
            const content = await readFile(file, "utf-8");
            if (hasRemoteImages(content)) {
              filesWithRemote.push({ file, content });
            }
          } catch {
            // ignore unreadable files
          }
        }

        if (filesWithRemote.length > 0) {
          tempDir = await mkdtemp(path.join(tmpdir(), "cv-epub-img-"));
          const newFiles: string[] = [];
          for (const file of mdFiles) {
            const item = filesWithRemote.find((f) => f.file === file);
            if (item) {
              const updatedContent = await preprocessRemoteImages(
                item.content,
                tempDir,
              );
              const tempMdPath = path.join(tempDir, path.basename(file));
              await writeFile(tempMdPath, updatedContent);
              newFiles.push(tempMdPath);
            } else {
              newFiles.push(file);
            }
          }
          effectiveMdFiles = newFiles;
        }
      }

      try {
        const args = ["pandoc", ...effectiveMdFiles, "-f", "markdown", "-t", "epub"];

        // Default --toc for epub unless explicitly disabled (--no-toc sets flags.toc = false)
        if (context.flags.toc !== false) {
          args.push("--toc");
        }
        if (context.flags.numberSections) {
          args.push("--number-sections");
        }
        if (context.flags.wrap) {
          args.push(`--wrap=${context.flags.wrap}`);
        }
        if (metadataFilePath) {
          args.push(`--metadata-file=${metadataFilePath}`);
        }
        if (coverImagePath) {
          args.push(`--epub-cover-image=${coverImagePath}`);
        }
        // If no title in metadata, provide fallback from output filename
        if (!hasTitleInMetadata) {
          const outTitle = path.basename(output).replace(/\.[^/.]+$/, "");
          args.push("-M", `title:${outTitle}`);
        }

        args.push(...context.passthroughArgs, "-o", output);

        await runCommand(args, { dryRun: context.dryRun });
      } finally {
        if (tempDir) {
          await rm(tempDir, { recursive: true, force: true });
        }
      }
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
