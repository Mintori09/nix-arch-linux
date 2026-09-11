#!/usr/bin/env tsx
import { spawn, spawnSync, ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { createServer, Socket } from "node:net";
import { join } from "node:path";
import { args, isMain, which } from "./utils.ts";

const VIDEO_EXTENSIONS = ["mp4", "mkv", "avi", "mov", "webm", "flv"];
const CACHE_DIR = `${process.env.XDG_CACHE_HOME || `${process.env.HOME}/.cache`}/fzf-preview`;

function getCachePath(target: string, ext: string): string {
  const sum =
    spawnSync("cksum", { input: target, encoding: "utf-8" }).stdout?.split(
      " ",
    )[0] ?? target.length.toString();
  return `${CACHE_DIR}/${sum}${ext}`;
}

function ensureThumbnail(file: string): void {
  const cache = getCachePath(file, ".jpg");
  if (existsSync(cache)) return;

  mkdirSync(CACHE_DIR, { recursive: true });

  if (which("ffprobe")) {
    const cover = spawnSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v",
        "-show_entries",
        "stream=index:stream_tags=title",
        "-of",
        "csv=p=0",
        file,
      ],
      { encoding: "utf-8" },
    );
    const coverLine = cover.stdout
      ?.split("\n")
      .find((l) => /cover|thumbnail|poster/i.test(l));
    if (coverLine) {
      const streamIdx = coverLine.split(",")[0];
      spawnSync(
        "ffmpeg",
        [
          "-y",
          "-i",
          file,
          "-map",
          `0:v:${streamIdx}`,
          "-frames:v",
          "1",
          "-q:v",
          "3",
          cache,
        ],
        { stdio: "ignore" },
      );
    }
  }

  if (!existsSync(cache) && which("ffmpeg")) {
    spawnSync(
      "ffmpeg",
      ["-y", "-i", file, "-map", "0:t:0", "-c", "copy", cache],
      { stdio: "ignore" },
    );
  }

  if (!existsSync(cache) && which("ffmpegthumbnailer")) {
    spawnSync(
      "ffmpegthumbnailer",
      ["-i", file, "-o", cache, "-s", "0", "-q", "5"],
      { stdio: "ignore" },
    );
  }

  if (!existsSync(cache) && which("ffmpeg")) {
    spawnSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        file,
        "-ss",
        "00:00:02",
        "-vframes",
        "1",
        "-an",
        "-q:v",
        "5",
        cache,
      ],
      { stdio: "ignore" },
    );
  }
}

class ThumbnailWorker {
  private queue: string[] = [];
  private processing = false;
  private currentChild: ChildProcess | null = null;
  private serverSocketPath: string;
  private server: ReturnType<typeof createServer> | null = null;

  constructor(allFiles: string[]) {
    this.queue = allFiles.filter((f) => !existsSync(getCachePath(f, ".jpg")));
    this.serverSocketPath = join(
      "/tmp",
      `vd-thumb-${process.pid}-${Date.now()}.sock`,
    );
    this.initServer();
    this.processNext();
  }

  private initServer(): void {
    try {
      if (existsSync(this.serverSocketPath)) {
        unlinkSync(this.serverSocketPath);
      }
    } catch {}

    this.server = createServer((socket: Socket) => {
      let buffer = "";
      socket.on("data", (data) => {
        buffer += data.toString("utf-8");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) this.prioritize(trimmed);
        }
      });
    });

    this.server.listen(this.serverSocketPath);
  }

  public getSocketPath(): string {
    return this.serverSocketPath;
  }

  public prioritize(file: string): void {
    if (existsSync(getCachePath(file, ".jpg"))) return;

    // Place at front of queue
    this.queue = [file, ...this.queue.filter((f) => f !== file)];

    // If currently generating a different thumbnail, abort it so priority file runs immediately
    if (this.currentChild) {
      try {
        this.currentChild.kill("SIGTERM");
      } catch {}
    }
  }

  private processNext(): void {
    if (this.processing) return;

    const file = this.queue.shift();
    if (!file) return;

    const cache = getCachePath(file, ".jpg");
    if (existsSync(cache)) {
      setImmediate(() => this.processNext());
      return;
    }

    this.processing = true;
    mkdirSync(CACHE_DIR, { recursive: true });

    // Use ffmpegthumbnailer if available for fast background extraction, else ffmpeg
    const cmd = which("ffmpegthumbnailer")
      ? {
          bin: "ffmpegthumbnailer",
          args: ["-i", file, "-o", cache, "-s", "0", "-q", "5"],
        }
      : {
          bin: "ffmpeg",
          args: [
            "-y",
            "-i",
            file,
            "-ss",
            "00:00:02",
            "-vframes",
            "1",
            "-an",
            "-q:v",
            "5",
            cache,
          ],
        };

    const child = spawn(cmd.bin, cmd.args, { stdio: "ignore" });
    this.currentChild = child;

    child.on("close", () => {
      this.currentChild = null;
      this.processing = false;
      this.processNext();
    });

    child.on("error", () => {
      this.currentChild = null;
      this.processing = false;
      this.processNext();
    });
  }

  public close(): void {
    this.queue = [];
    if (this.currentChild) {
      try {
        this.currentChild.kill("SIGTERM");
      } catch {}
      this.currentChild = null;
    }
    if (this.server) {
      try {
        this.server.close();
      } catch {}
      this.server = null;
    }
    try {
      if (existsSync(this.serverSocketPath)) {
        unlinkSync(this.serverSocketPath);
      }
    } catch {}
  }
}

function findAndOpenVideo(recursive: boolean): void {
  const fdArgs = ["-t", "f"];
  for (const ext of VIDEO_EXTENSIONS) {
    fdArgs.push("-e", ext);
  }
  if (!recursive) fdArgs.push("--max-depth", "1");

  const fd = spawnSync("fd", fdArgs, { encoding: "utf-8" });
  if (fd.status !== 0) {
    console.error("fd failed");
    process.exit(1);
  }

  const sorted = fd.stdout?.trim() ?? "";
  if (!sorted) {
    console.log("No video files found.");
    return;
  }

  const files = sorted
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
  const worker = new ThumbnailWorker(files);

  const socketPath = worker.getSocketPath();
  const fzfArgs = [
    "--style",
    "full",
    "--prompt",
    "Select a video: ",
    "--bind",
    `focus:execute-silent(python3 -c 'import socket; s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM); s.connect("${socketPath}"); s.sendall(("{}" + "\\n").encode()); s.close()' 2>/dev/null || true)`,
  ];

  const fzf = spawnSync("fzf", fzfArgs, {
    input: sorted,
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf-8",
  });

  worker.close();

  const file = fzf.stdout?.trim();
  if (!file) {
    console.log("No video selected.");
    return;
  }

  spawnSync("kitten", ["icat", "--clear"], { stdio: "ignore" });
  const child = spawnSync("xdg-open", [file], { stdio: "ignore" });
  if (child.status !== 0) {
    console.error(`Failed to open: ${file}`);
  }
}

function showHelp(): void {
  console.error(`Usage: vd [options]

Options:
  -r    Search recursively (include subdirectories)
  -h    Show this help message

By default, only searches for videos in the current directory.`);
}

function main(): void {
  const cliArgs = args;
  let recursive = false;

  for (const arg of cliArgs) {
    if (arg === "-r") recursive = true;
    else if (arg === "-h") {
      showHelp();
      return;
    }
  }

  findAndOpenVideo(recursive);
}

if (isMain(import.meta.url)) main();
