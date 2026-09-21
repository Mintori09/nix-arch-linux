#!/usr/bin/env tsx
import { spawn, spawnSync, ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { createServer, Socket } from "node:net";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { args, isMain, which, getFzfPreviewCachePath } from "./utils.ts";

const VIDEO_EXTENSIONS = ["mp4", "mkv", "avi", "mov", "webm", "flv"];
const CACHE_DIR = `${process.env.XDG_CACHE_HOME || `${process.env.HOME}/.cache`}/fzf-preview`;

function getCachePath(target: string, ext: string): string {
  return getFzfPreviewCachePath(target, ext);
}

function ensureThumbnail(file: string): void {
  const cache = getCachePath(file, ".jpg");
  if (existsSync(cache)) return;

  mkdirSync(CACHE_DIR, { recursive: true });

  // 1. Fastest: ffmpegthumbnailer
  if (which("ffmpegthumbnailer")) {
    spawnSync(
      "ffmpegthumbnailer",
      ["-i", file, "-o", cache, "-s", "0", "-q", "5"],
      { stdio: "ignore" },
    );
  }

  // 2. Embedded cover stream via ffmpeg
  if (!existsSync(cache) && which("ffmpeg")) {
    spawnSync(
      "ffmpeg",
      ["-y", "-i", file, "-map", "0:t:0", "-c", "copy", cache],
      { stdio: "ignore" },
    );
  }

  // 3. Frame at 2 seconds
  if (!existsSync(cache) && which("ffmpeg")) {
    spawnSync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        "00:00:02",
        "-i",
        file,
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

  // 4. Fallback: ffprobe cover stream
  if (!existsSync(cache) && which("ffprobe")) {
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
}

class ThumbnailWorker {
  private queue: string[] = [];
  private activeChildren: Map<string, ChildProcess> = new Map();
  private maxConcurrency: number;
  private serverSocketPath: string;
  private server: ReturnType<typeof createServer> | null = null;
  private closed = false;

  constructor(allFiles: string[]) {
    this.queue = allFiles.filter((f) => !existsSync(getCachePath(f, ".jpg")));
    const cpus = typeof availableParallelism === "function" ? availableParallelism() : 4;
    this.maxConcurrency = Math.max(2, Math.min(6, cpus - 1));
    this.serverSocketPath = join(
      "/tmp",
      `vd-thumb-${process.pid}-${Date.now()}.sock`,
    );
    this.initServer();
    this.processQueue();
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
    if (this.activeChildren.has(file)) return;

    // Put at very front of queue
    this.queue = [file, ...this.queue.filter((f) => f !== file)];

    // If at max capacity, interrupt the oldest non-priority background job
    if (this.activeChildren.size >= this.maxConcurrency) {
      const oldestKey = this.activeChildren.keys().next().value;
      if (oldestKey) {
        const child = this.activeChildren.get(oldestKey);
        try {
          child?.kill("SIGTERM");
        } catch {}
        this.activeChildren.delete(oldestKey);
        // Put back into queue so it finishes later
        this.queue.push(oldestKey);
      }
    }

    this.processQueue();
  }

  private processQueue(): void {
    if (this.closed) return;

    while (this.activeChildren.size < this.maxConcurrency && this.queue.length > 0) {
      const file = this.queue.shift();
      if (!file) break;

      const cache = getCachePath(file, ".jpg");
      if (existsSync(cache)) continue;

      mkdirSync(CACHE_DIR, { recursive: true });

      const cmd = which("ffmpegthumbnailer")
        ? {
            bin: "ffmpegthumbnailer",
            args: ["-i", file, "-o", cache, "-s", "0", "-q", "5"],
          }
        : {
            bin: "ffmpeg",
            args: [
              "-y",
              "-ss",
              "00:00:02",
              "-i",
              file,
              "-vframes",
              "1",
              "-an",
              "-q:v",
              "5",
              cache,
            ],
          };

      const child = spawn(cmd.bin, cmd.args, { stdio: "ignore" });
      this.activeChildren.set(file, child);

      const cleanup = () => {
        this.activeChildren.delete(file);
        this.processQueue();
      };

      child.on("close", cleanup);
      child.on("error", cleanup);
    }
  }

  public close(): void {
    this.closed = true;
    this.queue = [];
    for (const child of this.activeChildren.values()) {
      try {
        child.kill("SIGTERM");
      } catch {}
    }
    this.activeChildren.clear();

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
  const notifySocketCmd = which("socat")
    ? `echo {} | socat - UNIX-CONNECT:${socketPath} 2>/dev/null || true`
    : `python3 -c 'import socket, sys; s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM); s.connect("${socketPath}"); s.sendall(("{}" + "\\n").encode()); s.close()' 2>/dev/null || true`;

  const fzfArgs = [
    "--style",
    "full",
    "--prompt",
    "Select a video: ",
    "--bind",
    `focus:execute-silent(${notifySocketCmd})`,
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
