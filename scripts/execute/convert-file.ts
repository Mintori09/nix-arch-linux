#!/usr/bin/env bun
import path from "path";
import fs from "fs";

const COLORS = {
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  GRAY: "\x1b[90m",
  NC: "\x1b[0m",
};

const SPINNER_FRAMES = ["-", "\\", "|", "/"];
const SPINNER_INTERVAL_MS = 80;

type ConvertContext = {
  dryRun: boolean;
  passthroughArgs: string[];
  route: string;
};

type Converter = (
  input: string,
  output: string,
  context: ConvertContext,
) => Promise<void>;

class CommandExecutionError extends Error {
  command: string;
  stderr: string;
  exitCode: number;

  constructor(command: string, stderr: string, exitCode: number) {
    super(`Command failed with exit code ${exitCode}`);
    this.command = command;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

function shellEscape(value: string): string {
  if (/^[a-zA-Z0-9_./:@=+-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function formatCommand(parts: string[]): string {
  return parts.map(shellEscape).join(" ");
}

function shortStderr(stderr: string, maxLines = 8, maxChars = 700): string {
  const trimmed = stderr.trim();
  if (!trimmed) return "(empty stderr)";
  const lines = trimmed.split("\n").slice(0, maxLines).join("\n");
  if (lines.length <= maxChars) return lines;
  return `${lines.slice(0, maxChars)}...`;
}

function ensureOutputDir(output: string) {
  const outDir = path.dirname(output);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
}

export function buildSpinnerLabel(route: string): string {
  const [inputExt, outputExt] = route.split(":");
  return `Converting ${inputExt} -> ${outputExt}...`;
}

export function renderSpinnerFrame(frameIndex: number, label: string): string {
  const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
  return `\r\x1b[2K${COLORS.GRAY}${frame}${COLORS.NC} ${label}`;
}

export function clearSpinnerLine(): string {
  return "\r\x1b[2K";
}

export function shouldEnableSpinner(options: {
  dryRun: boolean;
  isTTY?: boolean;
}): boolean {
  return !options.dryRun && options.isTTY === true;
}

function writeClearSpinnerLine() {
  process.stdout.write(clearSpinnerLine());
}

async function withSpinner<T>(
  context: ConvertContext,
  task: () => Promise<T>,
): Promise<T> {
  if (!shouldEnableSpinner({ dryRun: context.dryRun, isTTY: process.stdout.isTTY })) {
    return await task();
  }

  const label = buildSpinnerLabel(context.route);
  let spinnerFrameIndex = 0;
  const render = () => {
    process.stdout.write(renderSpinnerFrame(spinnerFrameIndex, label));
    spinnerFrameIndex += 1;
  };

  render();
  const spinnerTimer = setInterval(render, SPINNER_INTERVAL_MS);

  try {
    return await task();
  } finally {
    clearInterval(spinnerTimer);
    writeClearSpinnerLine();
  }
}

async function runCommand(
  parts: string[],
  options: { dryRun: boolean; captureStdout?: boolean } = { dryRun: false },
) {
  const command = formatCommand(parts);
  if (options.dryRun) {
    console.log(`${COLORS.YELLOW}[dry-run]${COLORS.NC} ${command}`);
    return "";
  }

  const proc = Bun.spawn(parts, {
    stdout: options.captureStdout ? "pipe" : "inherit",
    stderr: "pipe",
  });

  const stderrPromise = new Response(proc.stderr).text();
  const stdoutPromise = options.captureStdout
    ? new Response(proc.stdout).text()
    : Promise.resolve("");

  const [exitCode, stderr, stdout] = await Promise.all([
    proc.exited,
    stderrPromise,
    stdoutPromise,
  ]);

  if (exitCode !== 0) {
    throw new CommandExecutionError(command, shortStderr(stderr), exitCode);
  }

  return stdout;
}

async function convertViaFFmpeg(
  input: string,
  output: string,
  context: ConvertContext,
  args: string[] = [],
) {
  await runCommand(["ffmpeg", "-y", "-i", input, ...args, output], {
    dryRun: context.dryRun,
  });
}

async function convertViaImageMagick(
  input: string,
  output: string,
  context: ConvertContext,
  extraArgs: string[] = [],
) {
  await runCommand(["magick", ...extraArgs, input, output], {
    dryRun: context.dryRun,
  });
}

async function convertViaPandoc(
  input: string,
  output: string,
  context: ConvertContext,
  from?: string,
  to?: string,
  params: string[] = [],
) {
  const fromFlag = from ? ["-f", from] : [];
  const toFlag = to ? ["-t", to] : [];
  const args = [
    "pandoc",
    input,
    ...fromFlag,
    ...toFlag,
    ...params,
    "-o",
    output,
  ];
  await runCommand(args, { dryRun: context.dryRun });
}

async function convertViaLibreOffice(
  input: string,
  output: string,
  context: ConvertContext,
  outExt: string,
) {
  const outDir = path.dirname(output);
  await runCommand(
    ["soffice", "--headless", "--convert-to", outExt, input, "--outdir", outDir],
    { dryRun: context.dryRun },
  );

  if (context.dryRun) {
    return;
  }

  const generatedFile = path.join(
    outDir,
    path.basename(input).replace(path.extname(input), `.${outExt}`),
  );
  if (generatedFile !== output) {
    fs.renameSync(generatedFile, output);
  }
}

async function convertViaYq(
  input: string,
  output: string,
  context: ConvertContext,
  inputFormat: string,
  outputFormat: string,
) {
  const text = await runCommand(
    ["yq", "-p", inputFormat, "-o", outputFormat, ".", input],
    {
      dryRun: context.dryRun,
      captureStdout: true,
    },
  );

  if (!context.dryRun) {
    fs.writeFileSync(output, text);
  }
}

const ROUTE_HANDLERS: Record<string, Converter> = {
  // Audio/Video
  "mp4:mkv": (input, output, context) =>
    convertViaFFmpeg(input, output, context, [
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
    ]),
  "mkv:mp4": (input, output, context) =>
    convertViaFFmpeg(input, output, context, [
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
    ]),
  "mov:mp4": (input, output, context) =>
    convertViaFFmpeg(input, output, context, [
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
    ]),
  "avi:mp4": (input, output, context) =>
    convertViaFFmpeg(input, output, context, [
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
    ]),
  "webm:mp4": (input, output, context) =>
    convertViaFFmpeg(input, output, context, [
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
    ]),
  "flv:mp4": (input, output, context) =>
    convertViaFFmpeg(input, output, context, [
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
    ]),
  "mp4:webm": (input, output, context) =>
    convertViaFFmpeg(input, output, context, [
      "-c:v",
      "libvpx-vp9",
      "-c:a",
      "libopus",
    ]),
  "mkv:webm": (input, output, context) =>
    convertViaFFmpeg(input, output, context, [
      "-c:v",
      "libvpx-vp9",
      "-c:a",
      "libopus",
    ]),
  "mp4:mp3": (input, output, context) =>
    convertViaFFmpeg(input, output, context, ["-vn", "-b:a", "192k"]),
  "wav:mp3": (input, output, context) =>
    convertViaFFmpeg(input, output, context, ["-vn", "-b:a", "192k"]),
  "flac:mp3": (input, output, context) =>
    convertViaFFmpeg(input, output, context, ["-vn", "-b:a", "192k"]),
  "m4a:mp3": (input, output, context) =>
    convertViaFFmpeg(input, output, context, ["-vn", "-b:a", "192k"]),
  "ogg:mp3": (input, output, context) =>
    convertViaFFmpeg(input, output, context, ["-vn", "-b:a", "192k"]),
  "mp3:wav": (input, output, context) =>
    convertViaFFmpeg(input, output, context, ["-vn"]),
  "mp3:ogg": (input, output, context) =>
    convertViaFFmpeg(input, output, context, ["-vn"]),
  "gif:mp4": (input, output, context) =>
    convertViaFFmpeg(input, output, context, [
      "-movflags",
      "+faststart",
      "-pix_fmt",
      "yuv420p",
    ]),

  // Images
  "png:jpg": (input, output, context) =>
    convertViaImageMagick(input, output, context),
  "svg:png": (input, output, context) =>
    convertViaImageMagick(input, output, context),
  "jpg:png": (input, output, context) =>
    convertViaImageMagick(input, output, context),
  "webp:png": (input, output, context) =>
    convertViaImageMagick(input, output, context),
  "heic:jpg": (input, output, context) =>
    convertViaImageMagick(input, output, context),
  "png:webp": (input, output, context) =>
    convertViaImageMagick(input, output, context),
  "jpg:webp": (input, output, context) =>
    convertViaImageMagick(input, output, context),
  "webp:jpg": (input, output, context) =>
    convertViaImageMagick(input, output, context),
  "tiff:png": (input, output, context) =>
    convertViaImageMagick(input, output, context),
  "bmp:png": (input, output, context) =>
    convertViaImageMagick(input, output, context),

  // Documents
  "md:pdf": async (input, output, context) => {
    const scriptDir = import.meta.dir;
    const cssPath = path.join(scriptDir, "style.css");

    const extraParams = ["--pdf-engine=weasyprint"];
    if (fs.existsSync(cssPath)) {
      extraParams.push("--css", cssPath);
    }

    await convertViaPandoc(input, output, context, "markdown", "pdf", [
      ...extraParams,
      "--highlight-style",
      "tango",
      "-V",
      "papersize:a4",
      "-V",
      "geometry:margin=2cm",
    ]);
  },
  "md:docx": (input, output, context) =>
    convertViaPandoc(input, output, context),
  "docx:md": (input, output, context) =>
    convertViaPandoc(input, output, context),
  "md:html": (input, output, context) =>
    convertViaPandoc(input, output, context, "markdown", "html"),
  "html:md": (input, output, context) =>
    convertViaPandoc(input, output, context, "html", "markdown"),
  "docx:html": (input, output, context) =>
    convertViaPandoc(input, output, context, "docx", "html"),
  "txt:md": (input, output, context) =>
    convertViaPandoc(input, output, context),
  "rst:md": (input, output, context) =>
    convertViaPandoc(input, output, context, "rst", "markdown"),
  "md:epub": async (input, output, context) => {
    const fileName = output.split("/").pop() || output;
    const cleanTitle = fileName.replace(/\.[^/.]+$/, "");
    const epubParams = ["-M", `title:${cleanTitle}`, ...context.passthroughArgs];
    await convertViaPandoc(
      input,
      output,
      context,
      "markdown",
      "epub",
      epubParams,
    );
  },

  // Office
  "docx:pdf": (input, output, context) =>
    convertViaLibreOffice(input, output, context, "pdf"),
  "xlsx:pdf": (input, output, context) =>
    convertViaLibreOffice(input, output, context, "pdf"),
  "pptx:pdf": (input, output, context) =>
    convertViaLibreOffice(input, output, context, "pdf"),
  "odt:pdf": (input, output, context) =>
    convertViaLibreOffice(input, output, context, "pdf"),
  "ods:pdf": (input, output, context) =>
    convertViaLibreOffice(input, output, context, "pdf"),
  "odp:pdf": (input, output, context) =>
    convertViaLibreOffice(input, output, context, "pdf"),
  "doc:pdf": (input, output, context) =>
    convertViaLibreOffice(input, output, context, "pdf"),
  "xls:pdf": (input, output, context) =>
    convertViaLibreOffice(input, output, context, "pdf"),
  "ppt:pdf": (input, output, context) =>
    convertViaLibreOffice(input, output, context, "pdf"),

  // PDF to Images
  "pdf:png": (input, output, context) =>
    runCommand(["pdftoppm", "-r", "200", "-png", input, output.replace(/\.png$/, "")], {
      dryRun: context.dryRun,
    }),
  "pdf:jpg": (input, output, context) =>
    runCommand(["pdftoppm", "-r", "200", "-jpeg", input, output.replace(/\.jpg$/, "")], {
      dryRun: context.dryRun,
    }),
  "pdf:webp": (input, output, context) =>
    runCommand(["pdftoppm", "-r", "200", "-png", input, output.replace(/\.webp$/, "")], {
      dryRun: context.dryRun,
    }),

  // Data
  "json:yaml": (input, output, context) =>
    convertViaYq(input, output, context, "json", "yaml"),
  "yaml:json": (input, output, context) =>
    convertViaYq(input, output, context, "yaml", "json"),
  "toml:json": (input, output, context) =>
    convertViaYq(input, output, context, "toml", "json"),
  "yaml:toml": (input, output, context) =>
    convertViaYq(input, output, context, "yaml", "toml"),
  "toml:yaml": (input, output, context) =>
    convertViaYq(input, output, context, "toml", "yaml"),
  "json:toml": (input, output, context) =>
    convertViaYq(input, output, context, "json", "toml"),
  "json:csv": (input, output, context) =>
    convertViaYq(input, output, context, "json", "csv"),
  "csv:json": (input, output, context) =>
    convertViaYq(input, output, context, "csv", "json"),
  "xml:json": (input, output, context) =>
    convertViaYq(input, output, context, "xml", "json"),
};

function printSupportedRoutes() {
  console.log(`${COLORS.BLUE}Supported conversions:${COLORS.NC}`);
  for (const route of Object.keys(ROUTE_HANDLERS).sort()) {
    console.log(`- ${route}`);
  }
}

async function run() {
  const rawArgs = Bun.argv.slice(2);
  const hasListFlag = rawArgs.includes("--list");
  const dryRun = rawArgs.includes("--dry-run");

  if (hasListFlag) {
    printSupportedRoutes();
    return;
  }

  const positionalArgs = rawArgs.filter(
    (arg) => arg !== "--dry-run" && arg !== "--list",
  );
  const [input, output, ...passthroughArgs] = positionalArgs;

  if (!input || !output) {
    console.log(
      `${COLORS.YELLOW}Usage:${COLORS.NC} bun cv.ts [--dry-run] [--list] <input_file> <output_file>`,
    );
    process.exit(1);
  }

  if (!fs.existsSync(input)) {
    console.error(
      `${COLORS.RED}Error:${COLORS.NC} Input file '${input}' not found.`,
    );
    process.exit(1);
  }

  const inExt = path.extname(input).slice(1).toLowerCase();
  const outExt = path.extname(output).slice(1).toLowerCase();
  const route = `${inExt}:${outExt}`;
  const context: ConvertContext = { dryRun, passthroughArgs, route };
  const converter = ROUTE_HANDLERS[route];

  if (!converter) {
    console.error(`${COLORS.RED}Unsupported conversion:${COLORS.NC} ${route}`);
    process.exit(1);
  }

  try {
    ensureOutputDir(output);
    await withSpinner(context, () => converter(input, output, context));

    console.log(
      `\n${COLORS.GREEN}Conversion successful:${COLORS.NC} ${output}${dryRun ? " (dry-run)" : ""}`,
    );
  } catch (err) {
    if (err instanceof CommandExecutionError) {
      console.error(`\n${COLORS.RED}Conversion failed:${COLORS.NC}`);
      console.error(
        `${COLORS.YELLOW}Command:${COLORS.NC} ${err.command}\n${COLORS.YELLOW}Exit code:${COLORS.NC} ${err.exitCode}\n${COLORS.YELLOW}stderr:${COLORS.NC}\n${err.stderr}`,
      );
    } else {
      console.error(`\n${COLORS.RED}Conversion failed:${COLORS.NC}`, err);
    }
    process.exit(1);
  }
}

if (import.meta.main) {
  await run();
}
