#!/usr/bin/env tsx

// src/cv.ts
import path7 from "node:path";
import {
  mkdir,
  mkdtemp as mkdtemp3,
  readFile as readFile2,
  writeFile as writeFile4,
  rm as rm4,
} from "node:fs/promises";
import { existsSync as existsSync2 } from "node:fs";
import { tmpdir as tmpdir4 } from "node:os";
import { parseArgs } from "node:util";

// src/utils.ts
import { fileURLToPath } from "node:url";
import { access } from "node:fs/promises";
import { constants as FS_CONSTANTS } from "node:fs";
var args = process.argv.slice(2);
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isMain(metaUrl) {
  return fileURLToPath(metaUrl) === process.argv[1];
}
async function pathExists(filePath) {
  try {
    await access(filePath, FS_CONSTANTS.F_OK);
    return true;
  } catch {
    return false;
  }
}
var COLORS = {
  RED: "\x1B[31m",
  CYAN: "\x1B[36m",
  GREEN: "\x1B[32m",
  MAGENTA: "\x1B[35m",
  YELLOW: "\x1B[33m",
  BLUE: "\x1B[34m",
  GRAY: "\x1B[90m",
  NC: "\x1B[0m",
};

// src/config.ts
import path from "node:path";
import os from "node:os";
import { existsSync, readFileSync } from "node:fs";
var BUILTIN_DEFAULTS = {
  "md:pdf": { pageSize: "a4" },
};
var CONFIG_DIR = path.join(os.homedir(), ".config", "convert-file");
var CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
function loadReferenceDocConfig(configDir) {
  const dir = configDir ?? CONFIG_DIR;
  const cfgPath = path.join(dir, "config.json");
  const data = readJson(cfgPath);
  if (data && typeof data === "object" && data !== null) {
    const d = data;
    if (
      d.referenceDocs &&
      typeof d.referenceDocs === "object" &&
      !Array.isArray(d.referenceDocs)
    ) {
      return d.referenceDocs;
    }
  }
  return {};
}
function loadStyleConfig(configDir) {
  const dir = configDir ?? CONFIG_DIR;
  const cfgPath = path.join(dir, "config.json");
  const data = readJson(cfgPath);
  if (data && typeof data === "object" && data !== null) {
    const d = data;
    if (d.styles && typeof d.styles === "object" && !Array.isArray(d.styles)) {
      return d.styles;
    }
  }
  return {};
}
function resolveAlias(style, aliases) {
  return aliases[style] ?? null;
}
function resolveStylePath(style) {
  const resolved = style.startsWith("~/")
    ? path.join(os.homedir(), style.slice(2))
    : style;
  if (path.isAbsolute(resolved)) return existsSync(resolved) ? resolved : null;
  const absolute = path.resolve(process.cwd(), resolved);
  return existsSync(absolute) ? absolute : null;
}
function loadDefaults(route, configDir) {
  const dir = configDir ?? CONFIG_DIR;
  const cfgPath = path.join(dir, "config.json");
  const data = readJson(cfgPath);
  const result = {};
  const builtin = BUILTIN_DEFAULTS[route];
  if (builtin) {
    if (builtin.pageSize) result.pageSize = builtin.pageSize;
    if (builtin.toc !== void 0) result.toc = builtin.toc;
    if (builtin.numberSections !== void 0)
      result.numberSections = builtin.numberSections;
    if (builtin.metadataFile) result.metadataFile = builtin.metadataFile;
    if (builtin.wrap) result.wrap = builtin.wrap;
    if (builtin.extractMedia) result.extractMedia = builtin.extractMedia;
    if (builtin.referenceDoc) result.referenceDoc = builtin.referenceDoc;
    if (builtin.css) {
      const resolved = resolveStylePath(builtin.css);
      if (resolved) result.style = resolved;
    }
  }
  if (data && typeof data === "object" && data !== null) {
    const d = data;
    if (
      d.defaults &&
      typeof d.defaults === "object" &&
      !Array.isArray(d.defaults)
    ) {
      const routeCfg = d.defaults[route];
      if (routeCfg) {
        if (routeCfg.css && typeof routeCfg.css === "string") {
          const resolved = resolveStylePath(routeCfg.css);
          if (resolved) result.style = resolved;
        }
        if (routeCfg.pageSize && typeof routeCfg.pageSize === "string")
          result.pageSize = routeCfg.pageSize;
        if (typeof routeCfg.toc === "boolean") result.toc = routeCfg.toc;
        if (typeof routeCfg.numberSections === "boolean")
          result.numberSections = routeCfg.numberSections;
        if (routeCfg.metadataFile && typeof routeCfg.metadataFile === "string")
          result.metadataFile = routeCfg.metadataFile;
        if (routeCfg.wrap && typeof routeCfg.wrap === "string")
          result.wrap = routeCfg.wrap;
        if (routeCfg.extractMedia && typeof routeCfg.extractMedia === "string")
          result.extractMedia = routeCfg.extractMedia;
        if (routeCfg.referenceDoc && typeof routeCfg.referenceDoc === "string")
          result.referenceDoc = routeCfg.referenceDoc;
      }
    }
  }
  return result;
}

// src/core/command.ts
import { spawn } from "node:child_process";

// src/errors.ts
var CliError = class extends Error {
  exitCode;
  constructor(message, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
};
var CommandExecutionError = class extends Error {
  command;
  stderr;
  exitCode;
  constructor(command, stderr, exitCode) {
    super(`Command failed with exit code ${exitCode}`);
    this.name = "CommandExecutionError";
    this.command = command;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
};

// src/core/command.ts
function shellEscape(value) {
  if (/^[a-zA-Z0-9_./:@=+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
function formatCommand(parts) {
  return parts.map(shellEscape).join(" ");
}
function shortStderr(stderr, maxLines = 8, maxChars = 700) {
  const trimmed = stderr.trim();
  if (!trimmed) return "(empty stderr)";
  const lines = trimmed.split("\n").slice(0, maxLines).join("\n");
  return lines.length <= maxChars ? lines : `${lines.slice(0, maxChars)}...`;
}
async function runCommand(parts, options = { dryRun: false }) {
  const command = formatCommand(parts);
  if (options.dryRun) {
    console.log(`${COLORS.YELLOW}[dry-run]${COLORS.NC} ${command}`);
    return "";
  } else {
    console.log(`${COLORS.YELLOW}[run]${COLORS.NC} ${command}`);
  }
  const proc = spawn(parts[0], parts.slice(1), {
    stdio: ["ignore", options.captureStdout ? "pipe" : "inherit", "pipe"],
  });
  let stderr = "";
  let stdout = "";
  proc.stderr.on("data", (d) => (stderr += d.toString()));
  if (options.captureStdout) {
    proc.stdout.on("data", (d) => (stdout += d.toString()));
  }
  const exitCode = await new Promise((r) => proc.on("close", r));
  if (exitCode !== 0) {
    throw new CommandExecutionError(command, shortStderr(stderr), exitCode);
  }
  return stdout;
}

// src/ui/spinner.ts
var SPINNER_FRAMES = [
  "\u280B",
  "\u2819",
  "\u2839",
  "\u2838",
  "\u283C",
  "\u2834",
  "\u2826",
  "\u2827",
  "\u2807",
  "\u280F",
];
var SPINNER_INTERVAL_MS = 80;
var SPINNER_DELAY_MS = 300;
function buildSpinnerLabel(route) {
  const [inputExt, outputExt] = route.split(":");
  return `Converting ${COLORS.CYAN}${inputExt}${COLORS.NC} -> ${COLORS.CYAN}${outputExt}${COLORS.NC}...`;
}
function updateLine(content) {
  process.stdout.write(`\r\x1B[2K${content}`);
}
function shouldEnableSpinner(options) {
  return (
    !options.dryRun && options.isTTY === true && process.env.NO_SPINNER !== "1"
  );
}
async function withSpinner(context, task) {
  if (
    !shouldEnableSpinner({
      dryRun: context.dryRun,
      isTTY: process.stdout.isTTY,
    })
  ) {
    return task();
  }
  const label = buildSpinnerLabel(context.route);
  const startTime = performance.now();
  let frameIndex = 0;
  let timer;
  const render = () => {
    const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
    updateLine(`${COLORS.MAGENTA}${frame}${COLORS.NC} ${label}`);
    frameIndex += 1;
  };
  const delay = setTimeout(() => {
    render();
    timer = setInterval(render, SPINNER_INTERVAL_MS);
  }, SPINNER_DELAY_MS);
  try {
    const result = await task();
    clearTimeout(delay);
    if (timer) clearInterval(timer);
    const duration = ((performance.now() - startTime) / 1e3).toFixed(2);
    updateLine(
      `${COLORS.GREEN}\u2714${COLORS.NC} ${label} ${COLORS.GRAY}(${duration}s)${COLORS.NC}
`,
    );
    return result;
  } catch (error) {
    clearTimeout(delay);
    if (timer) clearInterval(timer);
    updateLine(
      `${COLORS.RED}\u2716${COLORS.NC} ${label} ${COLORS.RED}Failed${COLORS.NC}
`,
    );
    throw error;
  }
}

// src/routes.ts
import path5 from "node:path";

// src/converters/index.ts
import path3 from "node:path";
import { tmpdir as tmpdir2 } from "node:os";
import {
  mkdtemp as mkdtemp2,
  rename,
  writeFile as writeFile2,
  rm as rm2,
} from "node:fs/promises";

// src/core/chromium.ts
import path2 from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { spawn as spawn2 } from "node:child_process";
import { Buffer as Buffer2 } from "node:buffer";
function calculateViewportSize(metrics) {
  if (!Number.isFinite(metrics.width) || !Number.isFinite(metrics.height)) {
    throw new CliError(
      `${COLORS.RED}Error:${COLORS.NC} Chromium returned invalid page dimensions.`,
    );
  }
  return {
    width: Math.max(1, Math.ceil(metrics.width)),
    height: Math.max(1, Math.ceil(metrics.height) + 32),
  };
}
function parseDevToolsPort(text) {
  const match = text.match(
    /DevTools listening on ws:\/\/(?:127\.0\.0\.1|localhost):(\d+)\//,
  );
  if (!match) return void 0;
  return Number.parseInt(match[1], 10);
}
function waitForDevToolsPort(stream) {
  return new Promise((resolve, reject) => {
    let stderr = "";
    const onData = (chunk) => {
      stderr += chunk.toString();
      const port = parseDevToolsPort(stderr);
      if (port !== void 0) {
        cleanup();
        resolve(port);
      }
    };
    const onEnd = () => {
      cleanup();
      reject(new CommandExecutionError("chromium", shortStderr(stderr), 1));
    };
    const onError = (err) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      stream.removeListener("data", onData);
      stream.removeListener("end", onEnd);
      stream.removeListener("error", onError);
    };
    stream.on("data", onData);
    stream.on("end", onEnd);
    stream.on("error", onError);
  });
}
function waitForPageWebSocketUrl(port, pageUrl) {
  const endpoint = `http://127.0.0.1:${port}/json/list`;
  const startedAt = Date.now();
  return (async () => {
    while (Date.now() - startedAt < 5e3) {
      try {
        const targets = await fetch(endpoint).then((r) => r.json());
        const page = targets.find(
          (t) =>
            t.type === "page" && t.url === pageUrl && t.webSocketDebuggerUrl,
        );
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      } catch {}
      await sleep(50);
    }
    throw new CommandExecutionError(
      "chromium",
      `Timed out waiting for DevTools page target: ${pageUrl}`,
      1,
    );
  })();
}
var DevToolsSession = class {
  constructor(socket) {
    this.socket = socket;
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error)
        pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    });
  }
  nextId = 1;
  pending = /* @__PURE__ */ new Map();
  send(method, params = {}) {
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value), reject });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }
  close() {
    this.socket.close();
  }
};
async function openDevToolsSession(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("DevTools WebSocket failed")),
      { once: true },
    );
  });
  return new DevToolsSession(socket);
}
async function waitForDocumentReady(session) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5e3) {
    const result = await session.send("Runtime.evaluate", {
      expression: "document.readyState",
      returnByValue: true,
    });
    if (result.result.value === "complete") return;
    await sleep(50);
  }
  throw new CommandExecutionError(
    "chromium",
    "Timed out waiting for document.readyState=complete",
    1,
  );
}
async function captureMhtmlScreenshot(input, output, context) {
  const pageUrl = pathToFileURL(input).href;
  if (context.dryRun) {
    await runCommand(
      [
        "chromium",
        "--headless",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--remote-debugging-port=0",
        "--remote-allow-origins=*",
        ...context.passthroughArgs,
        pageUrl,
      ],
      { dryRun: true },
    );
    return;
  }
  const userDataDir = await mkdtemp(path2.join(tmpdir(), "cv-chromium-"));
  const proc = spawn2(
    "chromium",
    [
      "--headless",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--remote-debugging-port=0",
      "--remote-allow-origins=*",
      `--user-data-dir=${userDataDir}`,
      ...context.passthroughArgs,
      pageUrl,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const exitedPromise = new Promise((r) => proc.on("close", r));
  try {
    const port = await waitForDevToolsPort(proc.stderr);
    const webSocketUrl = await waitForPageWebSocketUrl(port, pageUrl);
    const session = await openDevToolsSession(webSocketUrl);
    try {
      await session.send("Page.enable");
      await waitForDocumentReady(session);
      await session.send("Runtime.evaluate", {
        expression: "document.fonts ? document.fonts.ready : Promise.resolve()",
        awaitPromise: true,
      });
      const metrics = await session.send("Page.getLayoutMetrics");
      const viewport = calculateViewportSize(metrics.contentSize);
      await session.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      const screenshot = await session.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        clip: {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height,
          scale: 1,
        },
      });
      await writeFile(output, Buffer2.from(screenshot.data, "base64"));
    } finally {
      session.close();
    }
  } finally {
    proc.kill();
    await exitedPromise.catch(() => void 0);
    await rm(userDataDir, { recursive: true, force: true });
  }
}

// src/converters/index.ts
function ffmpeg(args2 = []) {
  return {
    tool: "ffmpeg",
    convert: (input, output, context) =>
      runCommand(
        [
          "ffmpeg",
          "-y",
          "-i",
          input,
          ...args2,
          ...context.passthroughArgs,
          output,
        ],
        {
          dryRun: context.dryRun,
        },
      ).then(() => void 0),
  };
}
function imageMagick(extraArgs = []) {
  return {
    tool: "magick",
    convert: (input, output, context) =>
      runCommand(
        ["magick", ...extraArgs, ...context.passthroughArgs, input, output],
        {
          dryRun: context.dryRun,
        },
      ).then(() => void 0),
  };
}
function pandoc(options = {}) {
  return {
    tool: "pandoc",
    convert: async (input, output, context) => {
      const { flags, dryRun } = context;
      const isPdf = /\.pdf$/i.test(output);
      const isDocx = output.endsWith(".docx");
      const inExt = path3.extname(input).toLowerCase();
      const mediaDir = flags.extractMedia
        ? flags.extractMedia
        : inExt === ".docx" || inExt === ".md"
          ? `${output.replace(/\.[^/.]+$/, "")}_media/`
          : null;
      const flagParams = [
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
          ? resolveStylePath(flags.style)
          : "",
        mediaDir ? `--extract-media=${mediaDir}` : "",
      ].filter(Boolean);
      const args2 = [
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
      await runCommand(args2, { dryRun });
    },
  };
}
function libreOffice(outExt) {
  return {
    tool: "soffice",
    convert: async (input, output, context) => {
      const outDir = path3.dirname(output);
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
      const generatedFile = path3.join(
        outDir,
        path3.basename(input, path3.extname(input)) + `.${outExt}`,
      );
      if (generatedFile !== output) await rename(generatedFile, output);
    },
  };
}
function xlsx2csvConverter() {
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
      if (!context.dryRun) await writeFile2(output, text);
    },
  };
}
function markitdownConverter() {
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
        await writeFile2(output, text);
      }
    },
  };
}
function yq(inputFormat, outputFormat) {
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
      if (!context.dryRun) await writeFile2(output, text);
    },
  };
}
function pdfToImage(kind, outputExt) {
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
function mhtmlToImage(outputExt) {
  return {
    tool: "chromium",
    convert: async (input, output, context) => {
      const tempDir = context.dryRun
        ? void 0
        : await mkdtemp2(path3.join(tmpdir2(), "cv-mhtml-"));
      const screenshotOutput =
        outputExt === "png"
          ? output
          : context.dryRun
            ? output.replace(new RegExp(`\\.${outputExt}$`, "i"), ".png")
            : path3.join(tempDir, "screenshot.png");
      try {
        await captureMhtmlScreenshot(input, screenshotOutput, context);
        if (outputExt !== "png")
          await runCommand(["magick", screenshotOutput, output], {
            dryRun: context.dryRun,
          });
      } finally {
        if (tempDir) await rm2(tempDir, { recursive: true, force: true });
      }
    },
  };
}

// src/converters/document.ts
import path4 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function mdToPdf() {
  return {
    tool: "pandoc",
    convert: async (input, output, context) => {
      const defaultCssPath = path4.join(
        path4.dirname(fileURLToPath2(import.meta.url)),
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
function mdToHtml() {
  return {
    tool: "pandoc",
    convert: async (input, output, context) => {
      const defaultCssPath = path4.join(
        path4.dirname(fileURLToPath2(import.meta.url)),
        "style.html.css",
      );
      const extraParams = ["-s"];
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

// src/routes.ts
var H264_AAC = ["-c:v", "libx264", "-c:a", "aac"];
var VP9_OPUS = ["-c:v", "libvpx-vp9", "-c:a", "libopus"];
var MP3_AUDIO = ["-vn", "-b:a", "192k"];
var ROUTES = {
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
  "icns:png": imageMagick(),
  "mhtml:png": mhtmlToImage("png"),
  "mhtml:jpg": mhtmlToImage("jpg"),
  "mhtml:webp": mhtmlToImage("webp"),
  "md:pdf": mdToPdf(),
  "md:docx": pandoc(),
  "docx:md": pandoc(),
  "md:html": mdToHtml(),
  "html:md": markitdownConverter(),
  "docx:html": pandoc({ from: "docx", to: "html" }),
  "txt:md": pandoc(),
  "rst:md": pandoc({ from: "rst", to: "markdown" }),
  "md:epub": pandoc({
    from: "markdown",
    to: "epub",
    paramsFromContext: (context, _input, output) => {
      return ["-M", `title:${path5.basename(output).replace(/\.[^/.]+$/, "")}`];
    },
  }),
  "docx:epub": pandoc({
    from: "docx",
    to: "epub",
    paramsFromContext: (context, _input, output) => {
      return ["-M", `title:${path5.basename(output).replace(/\.[^/.]+$/, "")}`];
    },
  }),
  "docx:pdf": libreOffice("pdf"),
  "docx:txt": pandoc({ from: "docx", to: "plain" }),
  "xlsx:pdf": libreOffice("pdf"),
  "xlsx:csv": xlsx2csvConverter(),
  "pptx:pdf": libreOffice("pdf"),
  "odt:pdf": libreOffice("pdf"),
  "ods:pdf": libreOffice("pdf"),
  "odp:pdf": libreOffice("pdf"),
  "doc:pdf": libreOffice("pdf"),
  "xls:pdf": libreOffice("pdf"),
  "ppt:pdf": libreOffice("pdf"),
  "pdf:png": pdfToImage("png", "png"),
  "pdf:jpg": pdfToImage("jpeg", "jpg"),
  "pdf:webp": pdfToImage("png", "webp"),
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

// src/converters/mermaid.ts
import { mkdtempSync } from "node:fs";
import { readFile, writeFile as writeFile3, rm as rm3 } from "node:fs/promises";
import path6 from "node:path";
import { tmpdir as tmpdir3 } from "node:os";
import { spawnSync } from "node:child_process";
var MERMAID_RE = /^\s*```\s*mermaid\s*$/im;
var MMDC_CONFIG = {
  theme: "default",
  backgroundColor: "white",
  width: 1200,
  height: 800,
};
function mmdcAvailable() {
  const result = spawnSync("which", ["mmdc"]);
  return result.status === 0;
}
function hasMermaidBlocks(content) {
  return MERMAID_RE.test(content);
}
async function tryPreprocessMermaid(content, context) {
  if (!hasMermaidBlocks(content)) return content;
  if (context.dryRun) return content;
  if (!mmdcAvailable()) {
    console.warn("mmdc not found on PATH; skipping mermaid preprocessing");
    return content;
  }
  const tmpDir = mkdtempSync(path6.join(tmpdir3(), "cv-mermaid-"));
  try {
    const configPath = path6.join(tmpDir, "mmdc-config.json");
    await writeFile3(configPath, JSON.stringify(MMDC_CONFIG, null, 2));
    const mmdPath = path6.join(tmpDir, "diagram.mmd");
    const svgPath = path6.join(tmpDir, "diagram.svg");
    const matches = content.matchAll(/```\s*mermaid\s*\n([\s\S]*?)```/gm);
    let result = content;
    let offset = 0;
    for (const match of matches) {
      const mermaidCode = match[1].trim();
      const fullMatch = match[0];
      const matchIndex = match.index + offset;
      await writeFile3(mmdPath, mermaidCode);
      await runCommand(
        ["mmdc", "-i", mmdPath, "-o", svgPath, "-c", configPath],
        { dryRun: false },
      );
      const svgContent = await readFile(svgPath, "utf-8");
      const base64Svg = Buffer.from(svgContent).toString("base64");
      const dataUri = `![](data:image/svg+xml;base64,${base64Svg})`;
      const before = result.slice(0, matchIndex);
      const after = result.slice(matchIndex + fullMatch.length);
      const newLen = dataUri.length - fullMatch.length;
      offset += newLen;
      result = before + dataUri + after;
    }
    return result;
  } finally {
    await rm3(tmpDir, { recursive: true, force: true });
  }
}

// src/cv.ts
var DEFAULT_CSS = {
  "pdf.css": `/* cv-cli default PDF style */
@page {
  size: A4;
  margin: 2cm;
}

body {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 12pt;
  line-height: 1.6;
  color: #1a1a1a;
}

h1 { font-size: 2em; margin-top: 1.5em; margin-bottom: 0.5em; page-break-before: always; }
h1:first-child { page-break-before: avoid; }
h2 { font-size: 1.5em; margin-top: 1.2em; margin-bottom: 0.4em; }
h3 { font-size: 1.25em; margin-top: 1em; margin-bottom: 0.3em; }

p { margin: 0.5em 0; }

pre {
  background: #f5f5f5;
  padding: 0.8em;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-family: "Fira Code", "Cascadia Code", Consolas, monospace;
  font-size: 0.9em;
  page-break-inside: avoid;
  overflow-x: auto;
}

code {
  font-family: "Fira Code", "Cascadia Code", Consolas, monospace;
  font-size: 0.9em;
  background: #f5f5f5;
  padding: 0.15em 0.3em;
  border-radius: 2px;
}

pre code { background: none; padding: 0; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  page-break-inside: avoid;
}

th, td {
  border: 1px solid #ccc;
  padding: 0.5em;
  text-align: left;
}

th { background: #f0f0f0; font-weight: bold; }

blockquote {
  margin: 0.5em 0;
  padding: 0 1em;
  border-left: 4px solid #ccc;
  color: #555;
}

img { max-width: 100%; height: auto; }

a { color: #0366d6; text-decoration: none; }
`,
  "html.css": `/* cv-cli default HTML style */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #1a1a1a;
  max-width: 800px;
  margin: 2em auto;
  padding: 0 1em;
  background: #fff;
}

h1 { font-size: 2em; margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; margin-top: 1.2em; margin-bottom: 0.4em; }
h3 { font-size: 1.25em; margin-top: 1em; margin-bottom: 0.3em; }

p { margin: 0.5em 0; }

pre {
  background: #f6f8fa;
  padding: 1em;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  font-family: "SF Mono", "Fira Code", Consolas, monospace;
  font-size: 0.85em;
  overflow-x: auto;
}

code {
  font-family: "SF Mono", "Fira Code", Consolas, monospace;
  font-size: 0.85em;
  background: #f6f8fa;
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

pre code { background: none; padding: 0; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  display: block;
  overflow-x: auto;
}

th, td {
  border: 1px solid #dfe2e5;
  padding: 0.5em;
  text-align: left;
}

th { background: #f6f8fa; font-weight: 600; }

tr:nth-child(even) { background: #fafbfc; }

blockquote {
  margin: 0.5em 0;
  padding: 0 1em;
  border-left: 4px solid #dfe2e5;
  color: #6a737d;
}

img { max-width: 100%; height: auto; }

a { color: #0366d6; text-decoration: none; }
a:hover { text-decoration: underline; }

ul, ol { padding-left: 2em; }

hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
`,
  "docx2html.css": `/* cv-cli default docx-to-HTML style */
body {
  font-family: Calibri, "Segoe UI", Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.5;
  color: #222;
  max-width: 900px;
  margin: 2em auto;
  padding: 0 1em;
}

h1 { font-size: 2em; margin-top: 1.5em; margin-bottom: 0.3em; }
h2 { font-size: 1.5em; margin-top: 1.3em; margin-bottom: 0.3em; }
h3 { font-size: 1.25em; margin-top: 1.1em; margin-bottom: 0.3em; }

p { margin: 0.3em 0; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5em 0;
}

th, td {
  border: 1px solid #999;
  padding: 0.3em 0.5em;
  text-align: left;
  vertical-align: top;
}

th { background: #eaeaea; font-weight: bold; }

tr:nth-child(even) { background: #f5f5f5; }

pre {
  background: #f5f5f5;
  padding: 0.5em;
  border: 1px solid #ccc;
  font-family: Consolas, "Courier New", monospace;
  font-size: 9pt;
  overflow-x: auto;
}

code {
  font-family: Consolas, "Courier New", monospace;
  font-size: 0.9em;
  background: #f4f4f4;
  padding: 0.1em 0.3em;
}

pre code { background: none; padding: 0; }

blockquote {
  margin: 0.3em 0;
  padding: 0 0.8em;
  border-left: 3px solid #bbb;
  color: #555;
}

ol, ul { padding-left: 2em; }

img { max-width: 100%; height: auto; }

a { color: #0563c1; text-decoration: underline; }
`,
};
async function ensureOutputDir(output) {
  await mkdir(path7.dirname(output), { recursive: true });
}
async function assertToolAvailable(tool, dryRun) {
  if (dryRun) return;
  try {
    await runCommand(["which", tool], { dryRun: false, captureStdout: true });
  } catch {
    throw new CliError(
      `${COLORS.RED}Missing dependency:${COLORS.NC} '${tool}' was not found in PATH.`,
    );
  }
}
function printSupportedRoutes() {
  console.log(`${COLORS.BLUE}Supported conversions:${COLORS.NC}`);
  for (const route of Object.keys(ROUTES).sort()) console.log(`- ${route}`);
}
function printUsage() {
  console.log(
    `${COLORS.YELLOW}Usage:${COLORS.NC} tsx src/index.ts [--dry-run] [--list] [--style=<file.css>] [--metadata-file=<file.json>] [--reference-doc=<file.docx>] [--toc] [--number-sections] [--wrap=<none|preserve>] [--extract-media=<dir>] [--page-size=<a3|a4|a5|letter|legal>] <input_file> <output_file> [...passthrough_args]`,
  );
  console.log(
    `       ${COLORS.YELLOW}cv init${COLORS.NC}        Initialize config directory at ${CONFIG_DIR}`,
  );
}
async function cmdInit() {
  const stylesDir = path7.join(CONFIG_DIR, "styles");
  await mkdir(stylesDir, { recursive: true });
  const cfgPath = path7.join(CONFIG_DIR, "config.json");
  if (!existsSync2(cfgPath)) {
    await writeFile4(
      cfgPath,
      JSON.stringify(
        {
          styles: {
            blog: "~/projects/blog/theme.css",
          },
          referenceDocs: {
            modern: "~/templates/modern.docx",
          },
          defaults: {
            "md:pdf": {
              css: "~/.config/convert-file/styles/pdf.css",
              pageSize: "a4",
              toc: true,
              numberSections: false,
              metadataFile: "~/metadata.json",
              wrap: "none",
            },
            "md:html": {
              css: "~/.config/convert-file/styles/html.css",
              toc: true,
              numberSections: true,
              metadataFile: "~/metadata.json",
              wrap: "none",
              extractMedia: "./media",
            },
            "md:epub": {
              toc: true,
              numberSections: false,
              metadataFile: "~/metadata.json",
            },
            "docx:html": {
              css: "~/.config/convert-file/styles/docx2html.css",
              extractMedia: "./media",
            },
          },
        },
        null,
        2,
      ),
    );
  }
  for (const [name, content] of Object.entries(DEFAULT_CSS)) {
    const cssPath = path7.join(stylesDir, name);
    if (!existsSync2(cssPath)) await writeFile4(cssPath, content);
  }
  console.log(`${COLORS.GREEN}Config initialized.${COLORS.NC}`);
  console.log(`  Config: ${cfgPath}`);
  console.log(`  Styles: ${stylesDir}/`);
  console.log(`
Edit ${cfgPath} to customize defaults and style aliases.`);
  console.log(`CLI flags (--style, --toc, etc.) override defaults.`);
}
function extensionOf(filePath) {
  return path7.extname(filePath).slice(1).toLowerCase();
}
async function convertOne(input, output, passthroughArgs, options) {
  if (!(await pathExists(input)))
    throw new CliError(
      `${COLORS.RED}Error:${COLORS.NC} Input file '${input}' not found.`,
    );
  const inExt = extensionOf(input);
  const outExt = extensionOf(output);
  if (!inExt || !outExt)
    throw new CliError(
      `${COLORS.RED}Error:${COLORS.NC} Both input and output need file extensions.`,
    );
  let tempInput;
  if (!options.dryRun && (inExt === "md" || inExt === "markdown")) {
    const content = await readFile2(input, "utf-8");
    if (hasMermaidBlocks(content)) {
      const preprocessed = await tryPreprocessMermaid(content, {
        dryRun: false,
      });
      if (preprocessed !== content) {
        const tdir = await mkdtemp3(path7.join(tmpdir4(), "cv-mermaid-"));
        tempInput = path7.join(tdir, "input.md");
        await writeFile4(tempInput, preprocessed);
      }
    }
  }
  const actualInput = tempInput ?? input;
  const route = `${inExt}:${outExt}`;
  const routeDefaults = loadDefaults(route);
  for (const [key, val] of Object.entries(routeDefaults)) {
    const k = key;
    if (options.flags[k] === void 0 && val !== void 0) {
      options.flags[k] = val;
    }
  }
  const routeConfig = ROUTES[route];
  if (!routeConfig)
    throw new CliError(
      `${COLORS.RED}Unsupported conversion:${COLORS.NC} ${route}`,
    );
  const context = {
    dryRun: options.dryRun,
    passthroughArgs,
    route,
    flags: options.flags,
  };
  await assertToolAvailable(routeConfig.tool, options.dryRun);
  await ensureOutputDir(output);
  try {
    await withSpinner(context, () =>
      routeConfig.convert(actualInput, output, context),
    );
  } finally {
    if (tempInput)
      await rm4(path7.dirname(tempInput), { recursive: true, force: true });
  }
  console.log(
    `
${COLORS.GREEN}Conversion successful:${COLORS.NC} ${output}${options.dryRun ? " (dry-run)" : ""}`,
  );
}
var KNOWN_BOOLEANS = /* @__PURE__ */ new Set([
  "dry-run",
  "list",
  "help",
  "toc",
  "number-sections",
  "no-dry-run",
  "no-list",
  "no-help",
  "no-toc",
  "no-number-sections",
]);
var KNOWN_STRINGS = /* @__PURE__ */ new Set([
  "style",
  "metadata-file",
  "reference-doc",
  "wrap",
  "extract-media",
  "page-size",
]);
function isCvOption(arg) {
  if (arg === "-h") return true;
  if (!arg.startsWith("--")) return false;
  const eqIdx = arg.indexOf("=");
  const name = eqIdx !== -1 ? arg.slice(2, eqIdx) : arg.slice(2);
  return KNOWN_BOOLEANS.has(name) || KNOWN_STRINGS.has(name);
}
function isCvStringOptionWithoutEquals(arg) {
  if (!arg.startsWith("--")) return false;
  if (arg.includes("=")) return false;
  const name = arg.slice(2);
  return KNOWN_STRINGS.has(name);
}
function splitArgs(rawArgs) {
  const cvArgs = [];
  const passthroughArgs = [];
  let positionalsCount = 0;
  let expectingValueFor = null;
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === "--") {
      passthroughArgs.push(...rawArgs.slice(i + 1));
      break;
    }
    if (expectingValueFor !== null) {
      cvArgs.push(arg);
      expectingValueFor = null;
      continue;
    }
    if (isCvOption(arg)) {
      cvArgs.push(arg);
      if (isCvStringOptionWithoutEquals(arg)) {
        expectingValueFor = arg;
      }
    } else {
      if (positionalsCount < 2 && !arg.startsWith("-")) {
        cvArgs.push(arg);
        positionalsCount++;
      } else {
        passthroughArgs.push(arg);
      }
    }
  }
  return { cvArgs, passthroughArgs };
}
function preprocessNegatedFlags(rawArgs, booleanNames) {
  const finalState = /* @__PURE__ */ new Map();
  const filteredArgs = [];
  const NEGATED_RE = /^--no-(.+)$/;
  const POSITIVE_RE = /^--([a-zA-Z][a-zA-Z0-9-]*)/;
  for (const arg of rawArgs) {
    const negMatch = arg.match(NEGATED_RE);
    if (negMatch && booleanNames.has(negMatch[1])) {
      finalState.set(negMatch[1], false);
      continue;
    }
    const posMatch = arg.match(POSITIVE_RE);
    if (posMatch && booleanNames.has(posMatch[1])) {
      finalState.set(posMatch[1], true);
    }
    filteredArgs.push(arg);
  }
  return { filteredArgs, finalState };
}
async function run() {
  const BOOLEAN_NAMES = /* @__PURE__ */ new Set([
    "dry-run",
    "list",
    "help",
    "toc",
    "number-sections",
  ]);
  const { cvArgs: splitCvArgs, passthroughArgs } = splitArgs(args);
  const { filteredArgs, finalState } = preprocessNegatedFlags(
    splitCvArgs,
    BOOLEAN_NAMES,
  );
  const parsed = parseArgs({
    args: filteredArgs,
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      list: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      style: { type: "string" },
      "metadata-file": { type: "string" },
      "reference-doc": { type: "string" },
      toc: { type: "boolean" },
      "number-sections": { type: "boolean" },
      wrap: { type: "string" },
      "extract-media": { type: "string" },
      "page-size": { type: "string" },
    },
  });
  const parsedValues = parsed.values;
  for (const [name, value] of finalState) {
    if (!value) {
      parsedValues[name] = false;
    }
  }
  const dryRun = parsed.values["dry-run"] === true;
  if (parsed.values.help) {
    printUsage();
    return;
  }
  if (parsed.values.list) {
    printSupportedRoutes();
    return;
  }
  const [input, output] = parsed.positionals;
  if (input === "init") {
    await cmdInit();
    return;
  }
  const conversionFlags = {
    style: parsed.values["style"],
    metadataFile: parsed.values["metadata-file"],
    referenceDoc: parsed.values["reference-doc"],
    toc: parsed.values["toc"],
    numberSections: parsed.values["number-sections"],
    wrap: parsed.values["wrap"],
    extractMedia: parsed.values["extract-media"],
    pageSize: parsed.values["page-size"],
  };
  const styleAliases = loadStyleConfig();
  if (conversionFlags.style) {
    const aliasPath = resolveAlias(conversionFlags.style, styleAliases);
    if (aliasPath) conversionFlags.style = aliasPath;
  }
  const refDocAliases = loadReferenceDocConfig();
  if (conversionFlags.referenceDoc) {
    const aliasPath = resolveAlias(conversionFlags.referenceDoc, refDocAliases);
    if (aliasPath) conversionFlags.referenceDoc = aliasPath;
  }
  if (!input || !output) {
    printUsage();
    throw new CliError("Input and output files are required.");
  }
  await convertOne(input, output, passthroughArgs, {
    dryRun,
    flags: conversionFlags,
  });
}

// src/index.ts
if (isMain(import.meta.url)) {
  (async () => {
    try {
      await run();
    } catch (err) {
      if (err instanceof CommandExecutionError) {
        console.error(`
${COLORS.RED}Conversion failed:${COLORS.NC}`);
        console.error(
          `${COLORS.YELLOW}Command:${COLORS.NC} ${err.command}
${COLORS.YELLOW}Exit code:${COLORS.NC} ${err.exitCode}
${COLORS.YELLOW}stderr:${COLORS.NC}
${err.stderr}`,
        );
        process.exit(1);
      }
      if (err instanceof CliError) {
        console.error(err.message);
        process.exit(err.exitCode);
      }
      console.error(
        `
${COLORS.RED}Conversion failed:${COLORS.NC}`,
        err,
      );
      process.exit(1);
    }
  })();
}
