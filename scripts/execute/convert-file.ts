#!/usr/bin/env bun
import path from "node:path";
import { access, mkdir, rename, writeFile } from "node:fs/promises";
import { constants as FS_CONSTANTS } from "node:fs";
import { parseArgs } from "node:util";

const COLORS = {
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  GRAY: "\x1b[90m",
  NC: "\x1b[0m",
} as const;

const SPINNER_FRAMES = ["-", "\\", "|", "/"] as const;
const SPINNER_INTERVAL_MS = 80;
const SPINNER_DELAY_MS = 300;

type ToolName = "ffmpeg" | "magick" | "pandoc" | "soffice" | "pdftoppm" | "yq";

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

type ToolConverter = {
  tool: ToolName;
  convert: Converter;
};

type CommandOptions = {
  dryRun: boolean;
  captureStdout?: boolean;
};

class CliError extends Error {
  exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

class CommandExecutionError extends Error {
  command: string;
  stderr: string;
  exitCode: number;

  constructor(command: string, stderr: string, exitCode: number) {
    super(`Command failed with exit code ${exitCode}`);
    this.name = "CommandExecutionError";
    this.command = command;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

const H264_AAC = ["-c:v", "libx264", "-c:a", "aac"] as const;
const VP9_OPUS = ["-c:v", "libvpx-vp9", "-c:a", "libopus"] as const;
const MP3_AUDIO = ["-vn", "-b:a", "192k"] as const;

function shellEscape(value: string): string {
  if (/^[a-zA-Z0-9_./:@=+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function formatCommand(parts: readonly string[]): string {
  return parts.map(shellEscape).join(" ");
}

function shortStderr(stderr: string, maxLines = 8, maxChars = 700): string {
  const trimmed = stderr.trim();
  if (!trimmed) return "(empty stderr)";

  const lines = trimmed.split("\n").slice(0, maxLines).join("\n");
  return lines.length <= maxChars ? lines : `${lines.slice(0, maxChars)}...`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, FS_CONSTANTS.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureOutputDir(output: string): Promise<void> {
  await mkdir(path.dirname(output), { recursive: true });
}

function buildSpinnerLabel(route: string): string {
  const [inputExt, outputExt] = route.split(":");
  return `Converting ${inputExt} -> ${outputExt}...`;
}

function renderSpinnerFrame(frameIndex: number, label: string): string {
  const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
  return `\r\x1b[2K${COLORS.GRAY}${frame}${COLORS.NC} ${label}`;
}

function clearSpinnerLine(): string {
  return "\r\x1b[2K";
}

function shouldEnableSpinner(options: {
  dryRun: boolean;
  isTTY?: boolean;
}): boolean {
  return (
    !options.dryRun && options.isTTY === true && process.env.NO_SPINNER !== "1"
  );
}

async function withSpinner<T>(
  context: ConvertContext,
  task: () => Promise<T>,
): Promise<T> {
  if (
    !shouldEnableSpinner({
      dryRun: context.dryRun,
      isTTY: process.stdout.isTTY,
    })
  ) {
    return task();
  }

  const label = buildSpinnerLabel(context.route);
  let frameIndex = 0;
  let timer: Timer | undefined;

  const render = () => {
    process.stdout.write(renderSpinnerFrame(frameIndex, label));
    frameIndex += 1;
  };

  const delay = setTimeout(() => {
    render();
    timer = setInterval(render, SPINNER_INTERVAL_MS);
  }, SPINNER_DELAY_MS);

  try {
    return await task();
  } finally {
    clearTimeout(delay);
    if (timer) clearInterval(timer);
    process.stdout.write(clearSpinnerLine());
  }
}

async function runCommand(
  parts: readonly string[],
  options: CommandOptions = { dryRun: false },
): Promise<string> {
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

async function assertToolAvailable(
  tool: ToolName,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;

  try {
    await runCommand(["which", tool], { dryRun: false, captureStdout: true });
  } catch {
    throw new CliError(
      `${COLORS.RED}Missing dependency:${COLORS.NC} '${tool}' was not found in PATH.`,
    );
  }
}

function ffmpeg(args: readonly string[] = []): ToolConverter {
  return {
    tool: "ffmpeg",
    convert: (input, output, context) =>
      runCommand(["ffmpeg", "-y", "-i", input, ...args, output], {
        dryRun: context.dryRun,
      }).then(() => undefined),
  };
}

function imageMagick(extraArgs: readonly string[] = []): ToolConverter {
  return {
    tool: "magick",
    convert: (input, output, context) =>
      runCommand(["magick", ...extraArgs, input, output], {
        dryRun: context.dryRun,
      }).then(() => undefined),
  };
}

function pandoc(
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
      const args = [
        "pandoc",
        input,
        ...(options.from ? ["-f", options.from] : []),
        ...(options.to ? ["-t", options.to] : []),
        ...(options.params ?? []),
        ...(options.paramsFromContext?.(context, input, output) ?? []),
        "-o",
        output,
      ];

      await runCommand(args, { dryRun: context.dryRun });
    },
  };
}

function libreOffice(outExt: string): ToolConverter {
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

      if (generatedFile !== output) {
        await rename(generatedFile, output);
      }
    },
  };
}

function yq(inputFormat: string, outputFormat: string): ToolConverter {
  return {
    tool: "yq",
    convert: async (input, output, context) => {
      const text = await runCommand(
        ["yq", "-p", inputFormat, "-o", outputFormat, ".", input],
        { dryRun: context.dryRun, captureStdout: true },
      );

      if (!context.dryRun) {
        await writeFile(output, text);
      }
    },
  };
}

function pdfToImage(
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
          input,
          output.replace(new RegExp(`\\.${outputExt}$`, "i"), ""),
        ],
        { dryRun: context.dryRun },
      );
    },
  };
}

function mdToPdf(): ToolConverter {
  return {
    tool: "pandoc",
    convert: async (input, output, context) => {
      const cssPath = path.join(import.meta.dir, "style.css");
      const extraParams = ["--pdf-engine=weasyprint"];

      if (await pathExists(cssPath)) {
        extraParams.push("--css", cssPath);
      }

      await pandoc({
        from: "markdown",
        to: "pdf",
        params: [
          ...extraParams,
          "--highlight-style",
          "tango",
          "-V",
          "papersize:a4",
          "-V",
          "geometry:margin=2cm",
        ],
      }).convert(input, output, context);
    },
  };
}

const ROUTES: Record<string, ToolConverter> = {
  // Audio / Video
  "mp4:mkv": ffmpeg(H264_AAC),
  "mkv:mp4": ffmpeg(H264_AAC),
  "mov:mp4": ffmpeg(H264_AAC),
  "avi:mp4": ffmpeg(H264_AAC),
  "webm:mp4": ffmpeg(H264_AAC),
  "flv:mp4": ffmpeg(H264_AAC),
  "mp4:webm": ffmpeg(VP9_OPUS),
  "mkv:webm": ffmpeg(VP9_OPUS),
  "mp4:mp3": ffmpeg(MP3_AUDIO),
  "wav:mp3": ffmpeg(MP3_AUDIO),
  "flac:mp3": ffmpeg(MP3_AUDIO),
  "m4a:mp3": ffmpeg(MP3_AUDIO),
  "ogg:mp3": ffmpeg(MP3_AUDIO),
  "mp3:wav": ffmpeg(["-vn"]),
  "mp3:ogg": ffmpeg(["-vn"]),
  "gif:mp4": ffmpeg(["-movflags", "+faststart", "-pix_fmt", "yuv420p"]),

  // Images
  "png:jpg": imageMagick(),
  "svg:png": imageMagick(),
  "jpg:png": imageMagick(),
  "webp:png": imageMagick(),
  "heic:jpg": imageMagick(),
  "png:webp": imageMagick(),
  "jpg:webp": imageMagick(),
  "webp:jpg": imageMagick(),
  "tiff:png": imageMagick(),
  "bmp:png": imageMagick(),

  // Documents
  "md:pdf": mdToPdf(),
  "md:docx": pandoc(),
  "docx:md": pandoc(),
  "md:html": pandoc({ from: "markdown", to: "html" }),
  "html:md": pandoc({ from: "html", to: "markdown" }),
  "docx:html": pandoc({ from: "docx", to: "html" }),
  "txt:md": pandoc(),
  "rst:md": pandoc({ from: "rst", to: "markdown" }),
  "md:epub": pandoc({
    from: "markdown",
    to: "epub",
    paramsFromContext: (context, _input, output) => {
      const cleanTitle = path.basename(output).replace(/\.[^/.]+$/, "");
      return ["-M", `title:${cleanTitle}`, ...context.passthroughArgs];
    },
  }),

  // Office
  "docx:pdf": libreOffice("pdf"),
  "xlsx:pdf": libreOffice("pdf"),
  "pptx:pdf": libreOffice("pdf"),
  "odt:pdf": libreOffice("pdf"),
  "ods:pdf": libreOffice("pdf"),
  "odp:pdf": libreOffice("pdf"),
  "doc:pdf": libreOffice("pdf"),
  "xls:pdf": libreOffice("pdf"),
  "ppt:pdf": libreOffice("pdf"),

  // PDF to Images
  "pdf:png": pdfToImage("png", "png"),
  "pdf:jpg": pdfToImage("jpeg", "jpg"),
  "pdf:webp": pdfToImage("png", "webp"),

  // Data
  "json:yaml": yq("json", "yaml"),
  "yaml:json": yq("yaml", "json"),
  "toml:json": yq("toml", "json"),
  "yaml:toml": yq("yaml", "toml"),
  "toml:yaml": yq("toml", "yaml"),
  "json:toml": yq("json", "toml"),
  "json:csv": yq("json", "csv"),
  "csv:json": yq("csv", "json"),
  "xml:json": yq("xml", "json"),
};

function printSupportedRoutes(): void {
  console.log(`${COLORS.BLUE}Supported conversions:${COLORS.NC}`);
  for (const route of Object.keys(ROUTES).sort()) {
    console.log(`- ${route}`);
  }
}

function printUsage(): void {
  console.log(
    `${COLORS.YELLOW}Usage:${COLORS.NC} bun cv.ts [--dry-run] [--list] <input_file> <output_file> [...passthrough_args]`,
  );
}

function extensionOf(filePath: string): string {
  return path.extname(filePath).slice(1).toLowerCase();
}

async function run(): Promise<void> {
  const parsed = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      list: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const dryRun = parsed.values["dry-run"] === true;

  if (parsed.values.help) {
    printUsage();
    return;
  }

  if (parsed.values.list) {
    printSupportedRoutes();
    return;
  }

  const [input, output, ...passthroughArgs] = parsed.positionals;

  if (!input || !output) {
    printUsage();
    throw new CliError("Input and output files are required.");
  }

  if (!(await pathExists(input))) {
    throw new CliError(
      `${COLORS.RED}Error:${COLORS.NC} Input file '${input}' not found.`,
    );
  }

  const inExt = extensionOf(input);
  const outExt = extensionOf(output);

  if (!inExt || !outExt) {
    throw new CliError(
      `${COLORS.RED}Error:${COLORS.NC} Both input and output need file extensions.`,
    );
  }

  const route = `${inExt}:${outExt}`;
  const routeConfig = ROUTES[route];

  if (!routeConfig) {
    throw new CliError(
      `${COLORS.RED}Unsupported conversion:${COLORS.NC} ${route}`,
    );
  }

  const context: ConvertContext = { dryRun, passthroughArgs, route };

  await assertToolAvailable(routeConfig.tool, dryRun);
  await ensureOutputDir(output);
  await withSpinner(context, () => routeConfig.convert(input, output, context));

  console.log(
    `\n${COLORS.GREEN}Conversion successful:${COLORS.NC} ${output}${dryRun ? " (dry-run)" : ""}`,
  );
}

if (import.meta.main) {
  try {
    await run();
  } catch (err) {
    if (err instanceof CommandExecutionError) {
      console.error(`\n${COLORS.RED}Conversion failed:${COLORS.NC}`);
      console.error(
        `${COLORS.YELLOW}Command:${COLORS.NC} ${err.command}\n${COLORS.YELLOW}Exit code:${COLORS.NC} ${err.exitCode}\n${COLORS.YELLOW}stderr:${COLORS.NC}\n${err.stderr}`,
      );
      process.exit(1);
    }

    if (err instanceof CliError) {
      console.error(err.message);
      process.exit(err.exitCode);
    }

    console.error(`\n${COLORS.RED}Conversion failed:${COLORS.NC}`, err);
    process.exit(1);
  }
}
