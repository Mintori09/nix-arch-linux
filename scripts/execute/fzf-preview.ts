#!/usr/bin/env tsx
import { spawnSync } from "child_process";
import { readFileSync, mkdirSync } from "fs";
import { isMain, which } from "./utils";

const CACHE_DIR = `${process.env.XDG_CACHE_HOME || `${process.env.HOME}/.cache`}/fzf-preview`;
mkdirSync(CACHE_DIR, { recursive: true });

function getCachePath(target: string, ext: string): string {
  const sum = spawnSync("cksum", { input: target, encoding: "utf-8" }).stdout?.split(" ")[0] ?? target.length.toString();
  return `${CACHE_DIR}/${sum}${ext}`;
}

function dim(): string {
  const cols = parseInt(process.env.FZF_PREVIEW_COLUMNS ?? "", 10) || spawnSync("tput", ["cols"], { encoding: "utf-8" }).stdout?.trim() || "80";
  const lines = parseInt(process.env.FZF_PREVIEW_LINES ?? "", 10) || spawnSync("tput", ["lines"], { encoding: "utf-8" }).stdout?.trim() || "24";
  return `${cols}x${lines}`;
}

function renderImage(target: string): void {
  const hasKitten = which("kitten");

  if ((process.env.KITTY_WINDOW_ID || process.env.GHOSTTY_RESOURCES_DIR) && hasKitten) {
    spawnSync("kitten", ["icat", "--clear", "--transfer-mode=memory", "--unicode-placeholder", "--stdin=no", `--place=${dim()}@0x0`, target], { stdio: "inherit" });
    process.stdout.write("\u001b[m");
    return;
  }

  if (process.env.TERM_PROGRAM === "WezTerm" && which("wezterm")) {
    spawnSync("wezterm", ["imgcat", target], { stdio: "inherit" });
    process.stdout.write("\u001b[m");
    return;
  }

  if (which("chafa")) {
    spawnSync("chafa", ["-s", dim(), target], { stdio: "inherit" });
    process.stdout.write("\u001b[m");
    return;
  }

  spawnSync("file", ["--brief", target], { stdio: "inherit" });
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("usage: preview FILENAME[:LINENO][:IGNORED]");
    process.exit(1);
  }

  let file = args[0].replace(/^~\//, `${process.env.HOME}/`);
  let center = 0;

  try {
    readFileSync(file);
  } catch {
    const m = file.match(/^(.+):(\d+)/);
    if (m) {
      try {
        readFileSync(m[1]);
        file = m[1];
        center = parseInt(m[2], 10);
      } catch {
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }

  const mimeResult = spawnSync("file", ["--brief", "--dereference", "--mime-type", file], { encoding: "utf-8" });
  if (mimeResult.status !== 0) process.exit(1);
  const type = mimeResult.stdout?.trim() ?? "";

  const termHeight = parseInt(process.env.FZF_PREVIEW_LINES ?? "", 10) || parseInt(spawnSync("tput", ["lines"], { encoding: "utf-8" }).stdout?.trim() || "24", 10);

  if (type === "inode/directory") {
    if (which("eza")) {
      spawnSync("eza", ["--long", "--tree", "--level=2", "--icons", "--color=always", file], { stdio: "inherit" });
    } else {
      spawnSync("tree", ["-L", "2", "-C", file], { stdio: "inherit" });
    }
    return;
  }

  if (type === "image/svg+xml") {
    const cache = getCachePath(file, ".png");
    if (!(() => { try { readFileSync(cache); return true; } catch { return false; } })() && which("rsvg-convert")) {
      spawnSync("rsvg-convert", [file, "-o", cache], { stdio: "ignore" });
    }
    try { readFileSync(cache); renderImage(cache); } catch { spawnSync("bat", ["--color=always", file], { stdio: "inherit" }); }
    return;
  }

  if (type.startsWith("image/")) {
    renderImage(file);
    return;
  }

  if (type === "application/pdf") {
    const cache = getCachePath(file, ".jpg");
    try {
      readFileSync(cache);
    } catch {
      if (which("pdftoppm")) {
        spawnSync("pdftoppm", ["-f", "1", "-l", "1", "-jpeg", "-singlefile", file, cache.replace(/\.jpg$/, "")], { stdio: "ignore" });
      } else {
        console.log("Install poppler/pdftoppm to preview PDFs");
        process.exit(0);
      }
    }
    try { readFileSync(cache); renderImage(cache); } catch { process.exit(1); }
    return;
  }

  if (type.startsWith("video/")) {
    const cache = getCachePath(file, ".jpg");
    try {
      readFileSync(cache);
    } catch {
      if (which("ffprobe")) {
        const cover = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "stream=index:stream_tags=title", "-of", "csv=p=0", file], { encoding: "utf-8" });
        const coverLine = cover.stdout?.split("\n").find(l => /cover|thumbnail|poster/i.test(l));
        if (coverLine) {
          const streamIdx = coverLine.split(",")[0];
          spawnSync("ffmpeg", ["-y", "-i", file, "-map", `0:v:${streamIdx}`, "-frames:v", "1", "-q:v", "3", cache], { stdio: "ignore" });
        }
      }
      if (!(() => { try { readFileSync(cache); return true; } catch { return false; } })() && which("ffmpeg")) {
        spawnSync("ffmpeg", ["-y", "-i", file, "-map", "0:t:0", "-c", "copy", cache], { stdio: "ignore" });
      }
      if (!(() => { try { readFileSync(cache); return true; } catch { return false; } })() && which("ffmpegthumbnailer")) {
        spawnSync("ffmpegthumbnailer", ["-i", file, "-o", cache, "-s", "0", "-q", "5"], { stdio: "ignore" });
      }
      if (!(() => { try { readFileSync(cache); return true; } catch { return false; } })()) {
        spawnSync("ffmpeg", ["-y", "-i", file, "-ss", "00:00:02", "-vframes", "1", "-an", "-q:v", "5", cache], { stdio: "ignore" });
      }
    }
    try { readFileSync(cache); renderImage(cache); } catch { spawnSync("file", ["--brief", file], { stdio: "inherit" }); }
    return;
  }

  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const cache = getCachePath(file, ".txt");
    if (!(() => { try { readFileSync(cache); return true; } catch { return false; } })() && which("cv")) {
      spawnSync("cv", [file, cache], { stdio: "ignore" });
    }
    try { const _ = readFileSync(cache); spawnSync("bat", ["--color=always", cache], { stdio: "inherit" }); } catch { spawnSync("file", ["--brief", file], { stdio: "inherit" }); }
    return;
  }

  if (type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const cache = getCachePath(file, ".csv");
    if (!(() => { try { readFileSync(cache); return true; } catch { return false; } })() && which("cv")) {
      spawnSync("cv", [file, cache], { stdio: "ignore" });
    }
    try {
      const data = readFileSync(cache, "utf-8");
      const col = spawnSync("column", ["-s,", "-t"], { input: data, encoding: "utf-8" });
      const lines = col.stdout?.split("\n").slice(0, termHeight).join("\n") ?? "";
      if (lines) {
        const bat = spawnSync("bat", ["--language=csv", "--color=always"], { input: lines, encoding: "utf-8" });
        process.stdout.write(bat.stdout ?? lines);
      }
    } catch { spawnSync("file", ["--brief", file], { stdio: "inherit" }); }
    return;
  }

  if (type === "application/json") {
    if (which("jq")) {
      spawnSync("jq", ["-C", ".", file], { stdio: "inherit" });
    } else {
      spawnSync("bat", ["--language=json", "--color=always", file], { stdio: "inherit" });
    }
    return;
  }

  if (type === "text/markdown") {
    if (which("glow")) {
      spawnSync("glow", ["-s", "dark", file], { stdio: "inherit" });
    } else if (which("mdcat")) {
      spawnSync("mdcat", [file], { stdio: "inherit" });
    } else {
      spawnSync("bat", ["--language=markdown", "--color=always", file], { stdio: "inherit" });
    }
    return;
  }

  if (type === "text/csv") {
    if (which("column")) {
      const col = spawnSync("column", ["-s,", "-t", file], { encoding: "utf-8" });
      const lines = col.stdout?.split("\n").slice(0, termHeight).join("\n") ?? "";
      if (lines) {
        const bat = spawnSync("bat", ["--language=csv", "--color=always"], { input: lines, encoding: "utf-8" });
        process.stdout.write(bat.stdout ?? lines);
      }
    } else {
      spawnSync("bat", ["--color=always", file], { stdio: "inherit" });
    }
    return;
  }

  if (["application/zip", "application/x-tar", "application/x-7z-compressed", "application/x-rar", "application/x-gzip", "application/x-bzip2", "application/x-xz"].includes(type)) {
    if (which("atool")) {
      const out = spawnSync("atool", ["--list", file], { encoding: "utf-8" });
      spawnSync("bat", ["--language=help", "--color=always"], { input: out.stdout ?? "", stdio: ["pipe", "inherit", "inherit"] });
    } else if (which("bsdtar")) {
      const out = spawnSync("bsdtar", ["--list", "--file", file], { encoding: "utf-8" });
      spawnSync("bat", ["--language=help", "--color=always"], { input: out.stdout ?? "", stdio: ["pipe", "inherit", "inherit"] });
    } else {
      spawnSync("file", ["--brief", file], { stdio: "inherit" });
    }
    return;
  }

  if (type === "application/epub+zip") {
    const cache = getCachePath(file, ".jpg");
    if (!(() => { try { readFileSync(cache); return true; } catch { return false; } })()) {
      const list = spawnSync("unzip", ["-l", file], { encoding: "utf-8" });
      const coverLine = list.stdout?.split("\n").find(l => /cover\.(jpg|jpeg|png)/i.test(l));
      if (coverLine) {
        const coverPath = coverLine.trim().split(/\s+/).pop() ?? "";
        if (coverPath) spawnSync("unzip", ["-p", file, coverPath], { stdio: ["ignore", "pipe", "ignore"], encoding: "binary" });
      }
    }
    try { const data = readFileSync(cache); if (data.length > 0) renderImage(cache); else throw new Error("empty"); }
    catch { spawnSync("unzip", ["-l", file], { stdio: "inherit" }); }
    return;
  }

  if (type.startsWith("text") || type.startsWith("application/")) {
    if (which("hexyl")) {
      spawnSync("hexyl", ["--border", "none", "--length", "1024", file], { stdio: "inherit" });
    } else {
      spawnSync("file", ["--brief", file], { stdio: "inherit" });
    }
    return;
  }

  const batCmd = which("bat") || which("batcat");
  if (batCmd) {
    let startLine = 0;
    if (center > termHeight / 2) startLine = center - Math.floor(termHeight / 2);
    spawnSync(batCmd, ["--style", process.env.BAT_STYLE || "numbers,changes", "--color=always", "--pager=never", `--highlight-line=${center}`, `--line-range`, `${startLine}:`, file], { stdio: "inherit" });
  } else {
    spawnSync("cat", [file], { stdio: "inherit" });
  }
}

if (isMain(import.meta.url)) main();
