#!/usr/bin/env bun

import { $ } from "bun";
import path from "path";
import fs from "fs";

const COLORS = {
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  NC: "\x1b[0m",
};

async function convertViaFFmpeg(
  input: string,
  output: string,
  args: string[] = [],
) {
  console.log(`${COLORS.BLUE}Encoding with FFmpeg...${COLORS.NC}`);
  await $`ffmpeg -y -i ${input} ${args} ${output}`.quiet();
}

async function convertViaImageMagick(
  input: string,
  output: string,
  extraArgs: string[] = [],
) {
  console.log(`${COLORS.BLUE}Converting image...${COLORS.NC}`);
  await $`convert ${extraArgs} ${input} ${output}`;
}

async function convertViaPandoc(
  input: string,
  output: string,
  from?: string,
  to?: string,
  params: string[] = [],
) {
  console.log(`${COLORS.BLUE}Converting document via Pandoc...${COLORS.NC}`);
  const fromFlag = from ? ["-f", from] : [];
  const toFlag = to ? ["-t", to] : [];

  await $`pandoc ${input} ${fromFlag} ${toFlag} ${params} -o ${output}`;
}

async function convertViaLibreOffice(
  input: string,
  output: string,
  outExt: string,
) {
  console.log(
    `${COLORS.BLUE}Converting Office format via LibreOffice...${COLORS.NC}`,
  );
  const outDir = path.dirname(output);
  await $`soffice --headless --convert-to ${outExt} ${input} --outdir ${outDir}`;

  const generatedFile = path.join(
    outDir,
    path.basename(input).replace(path.extname(input), `.${outExt}`),
  );
  if (generatedFile !== output) {
    fs.renameSync(generatedFile, output);
  }
}

async function convertViaYq(input: string, output: string, outExt: string) {
  console.log(`${COLORS.BLUE}Converting data format via yq...${COLORS.NC}`);
  await $`yq -o ${outExt} ${input} > ${output}`;
}

async function run() {
  const [, , input, output, ...args] = Bun.argv;

  if (!input || !output) {
    console.log(
      `${COLORS.YELLOW}Usage:${COLORS.NC} bun cv.ts <input_file> <output_file>`,
    );
    process.exit(1);
  }

  if (!fs.existsSync(input)) {
    console.error(
      `${COLORS.RED}Error:${COLORS.NC} Input file '${input}' not found.`,
    );
    process.exit(1);
  }
  const extraArgs = args.join(" ");

  const inExt = path.extname(input).slice(1).toLowerCase();
  const outExt = path.extname(output).slice(1).toLowerCase();
  const route = `${inExt}:${outExt}`;

  try {
    switch (route) {
      // Audio/Video
      case "mp4:mkv":
      case "mkv:mp4":
      case "mov:mp4":
        await convertViaFFmpeg(input, output, [
          "-c:v",
          "libx264",
          "-c:a",
          "aac",
        ]);
        break;

      case "mp4:mp3":
        await convertViaFFmpeg(input, output, ["-vn", "-b:a", "192k"]);
        break;

      // Images
      case "png:jpg":
      case "svg:png":
      case "jpg:png":
      case "webp:png":
      case "heic:jpg":
        await convertViaImageMagick(input, output);
        break;

      // Documents
      case "md:pdf":
        const scriptDir = import.meta.dir;
        const cssPath = path.join(scriptDir, "style.css");

        // Kiểm tra xem file CSS có tồn tại không trước khi chạy
        const extraParams = ["--pdf-engine=weasyprint"];
        if (fs.existsSync(cssPath)) {
          extraParams.push("--css", cssPath);
        }

        await convertViaPandoc(input, output, "markdown", "pdf", [
          ...extraParams,
          "--highlight-style",
          "tango",
          "-V",
          "papersize:a4",
          "-V",
          "geometry:margin=2cm",
        ]);
        break;

      case "md:docx":
      case "docx:md":
        await convertViaPandoc(input, output);
        break;
      case "md:epub":
        const fileName = output.split("/").pop() || output;
        const cleanTitle = fileName.replace(/\.[^/.]+$/, "");
        await convertViaPandoc(input, output, "markdown", "epub", [
          "-M",
          `title=${cleanTitle}`,
          extraArgs,
        ]);
        break;

      // Office
      case "docx:pdf":
      case "xlsx:pdf":
      case "pptx:pdf":
        await convertViaLibreOffice(input, output, "pdf");
        break;

      // Data
      case "json:yaml":
      case "yaml:json":
      case "toml:json":
        await convertViaYq(input, output, outExt);
        break;

      default:
        console.error(
          `${COLORS.RED}Unsupported conversion:${COLORS.NC} ${route}`,
        );
        process.exit(1);
    }

    console.log(
      `\n${COLORS.GREEN}Conversion successful:${COLORS.NC} ${output}`,
    );
  } catch (err) {
    console.error(`\n${COLORS.RED}Conversion failed:${COLORS.NC}`, err);
    process.exit(1);
  }
}

run();
