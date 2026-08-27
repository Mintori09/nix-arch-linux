import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rename, writeFile, rm, readFile } from "node:fs/promises";
import { runCommand } from "../core/command.ts";
import { captureMhtmlScreenshot } from "../core/chromium.ts";
import { resolveStylePath } from "../config.ts";
export type ToolName =
  | "chromium"
  | "ffmpeg"
  | "magick"
  | "pandoc"
  | "soffice"
  | "pdftoppm"
  | "yq"
  | "xlsx2csv"
  | "markitdown"
  | "unzip";

export interface ConversionFlags {
  style?: string;
  metadataFile?: string;
  referenceDoc?: string;
  toc?: boolean;
  numberSections?: boolean;
  wrap?: "none" | "preserve";
  extractMedia?: string;
  pageSize?: string;
}

export type ConvertContext = {
  dryRun: boolean;
  passthroughArgs: string[];
  route: string;
  flags: ConversionFlags;
};

export type Converter = (
  input: string,
  output: string,
  context: ConvertContext,
) => Promise<void>;

export type ToolConverter = { tool: ToolName; convert: Converter };

const H264_AAC = ["-c:v", "libx264", "-c:a", "aac"] as const;
const VP9_OPUS = ["-c:v", "libvpx-vp9", "-c:a", "libopus"] as const;
const MP3_AUDIO = ["-vn", "-b:a", "192k"] as const;

export function ffmpeg(args: readonly string[] = []): ToolConverter {
  return {
    tool: "ffmpeg",
    convert: (input, output, context) =>
      runCommand(
        [
          "ffmpeg",
          "-y",
          "-i",
          input,
          ...args,
          ...context.passthroughArgs,
          output,
        ],
        {
          dryRun: context.dryRun,
        },
      ).then(() => undefined),
  };
}

export function imageMagick(extraArgs: readonly string[] = []): ToolConverter {
  return {
    tool: "magick",
    convert: (input, output, context) =>
      runCommand(
        ["magick", ...extraArgs, ...context.passthroughArgs, input, output],
        {
          dryRun: context.dryRun,
        },
      ).then(() => undefined),
  };
}

export async function sanitizeImagePaths(
  outputPath: string,
  mediaDir: string | null,
  dryRun: boolean,
): Promise<void> {
  if (dryRun || !mediaDir) return;
  const ext = path.extname(outputPath).toLowerCase();
  if (ext !== ".md" && ext !== ".markdown") return;

  let content: string;
  try {
    content = await readFile(outputPath, "utf-8");
  } catch {
    return;
  }

  const imageRegex = /!\[.*?\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  let newContent = content;
  let modified = false;

  while ((match = imageRegex.exec(content)) !== null) {
    const imagePath = match[1];
    if (!imagePath.includes(" ")) continue;

    const newPath = imagePath.replace(/ /g, "-");
    const absOld = path.resolve(path.dirname(outputPath), imagePath);
    const absNew = path.resolve(path.dirname(outputPath), newPath);

    try {
      await rename(absOld, absNew);
    } catch {
      // file may not exist; still update markdown reference
    }

    newContent = newContent.replace(`(${imagePath})`, `(${newPath})`);
    modified = true;
  }

  if (modified) {
    await writeFile(outputPath, newContent);
  }
}

export function pandoc(
  options: {
    from?: string;
    to?: string;
    params?: readonly string[];
    paramsFromContext?: (
      context: ConvertContext,
      input: string,
      output: string,
    ) => string[];
  } = {},
): ToolConverter {
  return {
    tool: "pandoc",
    convert: async (input, output, context) => {
      const { flags, dryRun } = context;
      const isPdf = /\.pdf$/i.test(output);
      const isDocx = output.endsWith(".docx");
      const inExt = path.extname(input).toLowerCase();
      const userRequestedMedia = !!flags.extractMedia;

      const mediaDir = flags.extractMedia
        ? flags.extractMedia
        : inExt === ".docx" || inExt === ".md"
          ? `${output.replace(/\.[^/.]+$/, "")}_media/`
          : null;

      const flagParams: string[] = [
        flags.metadataFile ? `--metadata-file=${flags.metadataFile}` : "",
        flags.referenceDoc && isDocx
          ? `--reference-doc=${resolveStylePath(flags.referenceDoc)}`
          : "",
        flags.toc ? "--toc" : "",
        flags.numberSections ? "--number-sections" : "",
        flags.wrap ? `--wrap=${flags.wrap}` : "",
        flags.pageSize && isPdf ? "-V" : "",
        flags.pageSize && isPdf ? `papersize:${flags.pageSize}` : "",
        flags.style && resolveStylePath(flags.style) ? "--css" : "",
        flags.style && resolveStylePath(flags.style)
          ? resolveStylePath(flags.style)!
          : "",
        mediaDir ? `--extract-media=${mediaDir}` : "",
      ].filter(Boolean);

      const args = [
        "pandoc",
        input,
        ...(options.from ? ["-f", options.from] : []),
        ...(options.to ? ["-t", options.to] : []),
        ...(options.params ?? []),
        ...flagParams,
        ...context.passthroughArgs,
        ...(options.paramsFromContext?.(context, input, output) ?? []),
        "-o",
        output,
      ];

      await runCommand(args, { dryRun });
      await sanitizeImagePaths(output, mediaDir, dryRun);

      if (!userRequestedMedia && mediaDir && !dryRun) {
        await rm(mediaDir, { recursive: true, force: true });
      }
    },
  };
}

export function libreOffice(outExt: string): ToolConverter {
  return {
    tool: "soffice",
    convert: async (input, output, context) => {
      const outDir = path.dirname(output);
      await runCommand(
        [
          "soffice",
          "--headless",
          "--convert-to",
          outExt,
          ...context.passthroughArgs,
          input,
          "--outdir",
          outDir,
        ],
        { dryRun: context.dryRun },
      );
      if (context.dryRun) return;
      const generatedFile = path.join(
        outDir,
        path.basename(input, path.extname(input)) + `.${outExt}`,
      );
      if (generatedFile !== output) await rename(generatedFile, output);
    },
  };
}

export function xlsx2csvConverter(): ToolConverter {
  return {
    tool: "xlsx2csv",
    convert: async (input, output, context) => {
      const text = await runCommand(
        ["xlsx2csv", ...context.passthroughArgs, input],
        {
          dryRun: context.dryRun,
          captureStdout: true,
        },
      );
      if (!context.dryRun) await writeFile(output, text);
    },
  };
}

export function markitdownConverter(): ToolConverter {
  return {
    tool: "markitdown",
    convert: async (input, output, context) => {
      let text = await runCommand(
        ["markitdown", ...context.passthroughArgs, input],
        {
          dryRun: context.dryRun,
          captureStdout: true,
        },
      );

      if (text) {
        text = text.replace(/(?<=\S)\r?\n(?=\S)/g, " ");
      }

      if (!context.dryRun) {
        await writeFile(output, text);
      }
    },
  };
}

export function yq(inputFormat: string, outputFormat: string): ToolConverter {
  return {
    tool: "yq",
    convert: async (input, output, context) => {
      const text = await runCommand(
        [
          "yq",
          "-p",
          inputFormat,
          "-o",
          outputFormat,
          ...context.passthroughArgs,
          ".",
          input,
        ],
        { dryRun: context.dryRun, captureStdout: true },
      );
      if (!context.dryRun) await writeFile(output, text);
    },
  };
}

export function pdfToImage(
  kind: "png" | "jpeg",
  outputExt: "png" | "jpg" | "webp",
): ToolConverter {
  return {
    tool: "pdftoppm",
    convert: async (input, output, context) => {
      await runCommand(
        [
          "pdftoppm",
          "-r",
          "200",
          kind === "png" ? "-png" : "-jpeg",
          ...context.passthroughArgs,
          input,
          output.replace(new RegExp(`\\.${outputExt}$`, "i"), ""),
        ],
        { dryRun: context.dryRun },
      );
    },
  };
}

export function mhtmlToImage(outputExt: "png" | "jpg" | "webp"): ToolConverter {
  return {
    tool: "chromium",
    convert: async (input, output, context) => {
      const tempDir = context.dryRun
        ? undefined
        : await mkdtemp(path.join(tmpdir(), "cv-mhtml-"));
      const screenshotOutput =
        outputExt === "png"
          ? output
          : context.dryRun
            ? output.replace(new RegExp(`\\.${outputExt}$`, "i"), ".png")
            : path.join(tempDir!, "screenshot.png");
      try {
        await captureMhtmlScreenshot(input, screenshotOutput, context);
        if (outputExt !== "png")
          await runCommand(["magick", screenshotOutput, output], {
            dryRun: context.dryRun,
          });
      } finally {
        if (tempDir) await rm(tempDir, { recursive: true, force: true });
      }
    },
  };
}
