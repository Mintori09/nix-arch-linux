#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { args, isMain, which } from "./utils.ts";

const CACHE_DIR = `${process.env.XDG_CACHE_HOME || `${process.env.HOME}/.cache`}/fzf-preview`;
mkdirSync(CACHE_DIR, { recursive: true });

function getCachePath(target: string, ext: string): string {
  const sum =
    spawnSync("cksum", { input: target, encoding: "utf-8" }).stdout?.split(
      " ",
    )[0] ?? target.length.toString();
  return `${CACHE_DIR}/${sum}${ext}`;
}

function dim(options?: { heightOffset?: number }): string {
  const cols =
    parseInt(process.env.FZF_PREVIEW_COLUMNS ?? "", 10) ||
    spawnSync("tput", ["cols"], { encoding: "utf-8" }).stdout?.trim() ||
    "80";
  const lines =
    parseInt(process.env.FZF_PREVIEW_LINES ?? "", 10) ||
    spawnSync("tput", ["lines"], { encoding: "utf-8" }).stdout?.trim() ||
    "24";
  const adjustedLines = Math.max(
    1,
    parseInt(lines.toString(), 10) - (options?.heightOffset ?? 0),
  );
  return `${cols}x${adjustedLines}`;
}

function renderImage(
  target: string,
  options?: { yOffset?: number; heightOffset?: number },
): void {
  const hasKitten = which("kitten");
  const yOffset = options?.yOffset ?? 0;
  const heightOffset = options?.heightOffset ?? 0;

  if (
    (process.env.KITTY_WINDOW_ID || process.env.GHOSTTY_RESOURCES_DIR) &&
    hasKitten
  ) {
    spawnSync(
      "kitten",
      [
        "icat",
        "--clear",
        "--transfer-mode=memory",
        "--unicode-placeholder",
        "--stdin=no",
        `--place=${dim({ heightOffset })}@0x${yOffset}`,
        target,
      ],
      { stdio: "inherit" },
    );
    process.stdout.write("\u001b[m");
    return;
  }

  if (process.env.TERM_PROGRAM === "WezTerm" && which("wezterm")) {
    const lines = parseInt(process.env.FZF_PREVIEW_LINES ?? "24", 10);
    const height = Math.max(1, lines - heightOffset);
    spawnSync("wezterm", ["imgcat", "--height", height.toString(), target], {
      stdio: "inherit",
    });
    process.stdout.write("\u001b[m");
    return;
  }

  if (which("chafa")) {
    spawnSync("chafa", ["-s", dim({ heightOffset }), target], {
      stdio: "inherit",
    });
    process.stdout.write("\u001b[m");
    return;
  }

  spawnSync("file", ["--brief", target], { stdio: "inherit" });
}

function main(): void {
  const cmdArgs = args;
  if (cmdArgs.length !== 1) {
    console.error("usage: preview FILENAME[:LINENO][:IGNORED]");
    process.exit(1);
  }

  let file = cmdArgs[0].replace(/^~\//, `${process.env.HOME}/`);
  let center = 0;

  try {
    statSync(file);
  } catch {
    const m = file.match(/^(.+):(\d+)/);
    if (m) {
      try {
        statSync(m[1]);
        file = m[1];
        center = parseInt(m[2], 10);
      } catch {
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }

  const mimeResult = spawnSync(
    "file",
    ["--brief", "--dereference", "--mime-type", file],
    { encoding: "utf-8" },
  );
  if (mimeResult.status !== 0) process.exit(1);
  const type = mimeResult.stdout?.trim() ?? "";

  const termHeight =
    parseInt(process.env.FZF_PREVIEW_LINES ?? "", 10) ||
    parseInt(
      spawnSync("tput", ["lines"], { encoding: "utf-8" }).stdout?.trim() ||
        "24",
      10,
    );

  if (type === "inode/directory") {
    if (which("eza")) {
      spawnSync(
        "eza",
        ["--long", "--tree", "--level=2", "--icons", "--color=always", file],
        { stdio: "inherit" },
      );
    } else {
      spawnSync("tree", ["-L", "2", "-C", file], { stdio: "inherit" });
    }
    return;
  }

  if (type === "image/svg+xml") {
    const cache = getCachePath(file, ".png");
    if (
      !(() => {
        try {
          readFileSync(cache);
          return true;
        } catch {
          return false;
        }
      })() &&
      which("rsvg-convert")
    ) {
      spawnSync("rsvg-convert", [file, "-o", cache], { stdio: "ignore" });
    }
    try {
      readFileSync(cache);
      renderImage(cache);
    } catch {
      spawnSync("bat", ["--color=always", file], { stdio: "inherit" });
    }
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
        spawnSync(
          "pdftoppm",
          [
            "-f",
            "1",
            "-l",
            "1",
            "-jpeg",
            "-singlefile",
            file,
            cache.replace(/\.jpg$/, ""),
          ],
          { stdio: "ignore" },
        );
      } else {
        console.log("Install poppler/pdftoppm to preview PDFs");
        process.exit(0);
      }
    }
    try {
      readFileSync(cache);
      renderImage(cache);
    } catch {
      process.exit(1);
    }
    return;
  }

  if (type.startsWith("video/")) {
    const cache = getCachePath(file, ".jpg");
    try {
      readFileSync(cache);
    } catch {
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
      if (
        !(() => {
          try {
            readFileSync(cache);
            return true;
          } catch {
            return false;
          }
        })() &&
        which("ffmpeg")
      ) {
        spawnSync(
          "ffmpeg",
          ["-y", "-i", file, "-map", "0:t:0", "-c", "copy", cache],
          { stdio: "ignore" },
        );
      }
      if (
        !(() => {
          try {
            readFileSync(cache);
            return true;
          } catch {
            return false;
          }
        })() &&
        which("ffmpegthumbnailer")
      ) {
        spawnSync(
          "ffmpegthumbnailer",
          ["-i", file, "-o", cache, "-s", "0", "-q", "5"],
          { stdio: "ignore" },
        );
      }
      if (
        !(() => {
          try {
            readFileSync(cache);
            return true;
          } catch {
            return false;
          }
        })()
      ) {
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
    try {
      readFileSync(cache);
      renderImage(cache);
    } catch {
      spawnSync("file", ["--brief", file], { stdio: "inherit" });
    }
    return;
  }

  if (
    type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const cache = getCachePath(file, ".txt");
    if (
      !(() => {
        try {
          readFileSync(cache);
          return true;
        } catch {
          return false;
        }
      })() &&
      which("cv")
    ) {
      spawnSync("cv", [file, cache], { stdio: "ignore" });
    }
    try {
      const _ = readFileSync(cache);
      spawnSync("bat", ["--color=always", cache], { stdio: "inherit" });
    } catch {
      spawnSync("file", ["--brief", file], { stdio: "inherit" });
    }
    return;
  }

  if (
    type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    const cache = getCachePath(file, ".csv");
    if (
      !(() => {
        try {
          readFileSync(cache);
          return true;
        } catch {
          return false;
        }
      })() &&
      which("cv")
    ) {
      spawnSync("cv", [file, cache], { stdio: "ignore" });
    }
    try {
      const data = readFileSync(cache, "utf-8");
      const col = spawnSync("column", ["-s,", "-t"], {
        input: data,
        encoding: "utf-8",
      });
      const lines =
        col.stdout?.split("\n").slice(0, termHeight).join("\n") ?? "";
      if (lines) {
        const bat = spawnSync("bat", ["--language=csv", "--color=always"], {
          input: lines,
          encoding: "utf-8",
        });
        process.stdout.write(bat.stdout ?? lines);
      }
    } catch {
      spawnSync("file", ["--brief", file], { stdio: "inherit" });
    }
    return;
  }

  if (type === "application/json") {
    if (which("jq")) {
      spawnSync("jq", ["-C", ".", file], { stdio: "inherit" });
    } else {
      spawnSync("bat", ["--language=json", "--color=always", file], {
        stdio: "inherit",
      });
    }
    return;
  }

  if (type === "text/markdown") {
    if (which("glow")) {
      spawnSync("glow", ["-s", "dark", file], { stdio: "inherit" });
    } else if (which("mdcat")) {
      spawnSync("mdcat", [file], { stdio: "inherit" });
    } else {
      spawnSync("bat", ["--language=markdown", "--color=always", file], {
        stdio: "inherit",
      });
    }
    return;
  }

  if (type === "text/csv") {
    if (which("column")) {
      const col = spawnSync("column", ["-s,", "-t", file], {
        encoding: "utf-8",
      });
      const lines =
        col.stdout?.split("\n").slice(0, termHeight).join("\n") ?? "";
      if (lines) {
        const bat = spawnSync("bat", ["--language=csv", "--color=always"], {
          input: lines,
          encoding: "utf-8",
        });
        process.stdout.write(bat.stdout ?? lines);
      }
    } else {
      spawnSync("bat", ["--color=always", file], { stdio: "inherit" });
    }
    return;
  }

  if (
    [
      "application/zip",
      "application/x-tar",
      "application/x-7z-compressed",
      "application/x-rar",
      "application/x-gzip",
      "application/x-bzip2",
      "application/x-xz",
    ].includes(type)
  ) {
    if (which("atool")) {
      const out = spawnSync("atool", ["--list", file], { encoding: "utf-8" });
      spawnSync("bat", ["--language=help", "--color=always"], {
        input: out.stdout ?? "",
        stdio: ["pipe", "inherit", "inherit"],
      });
    } else if (which("bsdtar")) {
      const out = spawnSync("bsdtar", ["--list", "--file", file], {
        encoding: "utf-8",
      });
      spawnSync("bat", ["--language=help", "--color=always"], {
        input: out.stdout ?? "",
        stdio: ["pipe", "inherit", "inherit"],
      });
    } else {
      spawnSync("file", ["--brief", file], { stdio: "inherit" });
    }
    return;
  }

  if (type === "application/epub+zip") {
    const cache = getCachePath(file, ".jpg");
    let hasCover = false;
    let lineCount = 0;

    const unescapeXml = (str: string): string => {
      return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, dec) =>
          String.fromCharCode(parseInt(dec, 10)),
        )
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
          String.fromCharCode(parseInt(hex, 16)),
        );
    };

    try {
      const containerRes = spawnSync(
        "unzip",
        ["-p", file, "META-INF/container.xml"],
        {
          stdio: ["ignore", "pipe", "ignore"],
          encoding: "utf-8",
        },
      );
      if (containerRes.status === 0 && containerRes.stdout) {
        const opfPathMatch = containerRes.stdout.match(
          /<rootfile\s+[^>]*full-path=["']([^"']+)["']/i,
        );
        if (opfPathMatch) {
          const opfPath = decodeURIComponent(opfPathMatch[1]);
          let opfDir = "";
          const lastSlash = opfPath.lastIndexOf("/");
          if (lastSlash !== -1) {
            opfDir = opfPath.slice(0, lastSlash + 1);
          }

          const opfRes = spawnSync("unzip", ["-p", file, opfPath], {
            stdio: ["ignore", "pipe", "ignore"],
            encoding: "utf-8",
          });
          if (opfRes.status === 0 && opfRes.stdout) {
            const opfContent = opfRes.stdout;
            const title = unescapeXml(
              opfContent
                .match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]
                ?.trim() || "Unknown Title",
            );
            const creator = unescapeXml(
              opfContent
                .match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)?.[1]
                ?.trim() || "Unknown Author",
            );
            const publisher = unescapeXml(
              opfContent
                .match(/<dc:publisher[^>]*>([\s\S]*?)<\/dc:publisher>/i)?.[1]
                ?.trim() || "",
            );
            const date = unescapeXml(
              opfContent
                .match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i)?.[1]
                ?.trim() || "",
            );
            const language = unescapeXml(
              opfContent
                .match(/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i)?.[1]
                ?.trim() || "",
            );

            console.log(`\x1b[1;36mTitle:      \x1b[0m${title}`);
            console.log(`\x1b[1;36mAuthor:     \x1b[0m${creator}`);
            lineCount = 3;
            if (publisher) {
              console.log(`\x1b[1;36mPublisher:  \x1b[0m${publisher}`);
              lineCount++;
            }
            if (date) {
              console.log(`\x1b[1;36mPublished:  \x1b[0m${date.split("T")[0]}`);
              lineCount++;
            }
            if (language) {
              console.log(`\x1b[1;36mLanguage:   \x1b[0m${language}`);
              lineCount++;
            }
            console.log();

            let coverHref: string | null = null;
            const epub3CoverMatch =
              opfContent.match(
                /<item\s+[^>]*properties=["']cover(?:-image)?["'][^>]*href=["']([^"']+)["']/i,
              ) ||
              opfContent.match(
                /<item\s+[^>]*href=["']([^"']+)["'][^>]*properties=["']cover(?:-image)?["']/i,
              );
            if (epub3CoverMatch) {
              coverHref = epub3CoverMatch[1];
            }

            if (!coverHref) {
              const metaCoverMatch =
                opfContent.match(
                  /<meta\s+[^>]*name=["']cover["'][^>]*content=["']([^"']+)["']/i,
                ) ||
                opfContent.match(
                  /<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']cover["']/i,
                );
              if (metaCoverMatch) {
                const coverId = metaCoverMatch[1];
                const escapedId = coverId.replace(
                  /[-\/\\^$*+?.()|[\]{}]/g,
                  "\\$&",
                );
                const itemRegex1 = new RegExp(
                  `<item\\s+[^>]*id=["']${escapedId}["'][^>]*href=["']([^"']+)["']`,
                  "i",
                );
                const itemRegex2 = new RegExp(
                  `<item\\s+[^>]*href=["']([^"']+)["'][^>]*id=["']${escapedId}["']`,
                  "i",
                );
                const itemMatch =
                  opfContent.match(itemRegex1) || opfContent.match(itemRegex2);
                if (itemMatch) {
                  coverHref = itemMatch[1];
                }
              }
            }

            if (!coverHref) {
              const guideCoverMatch =
                opfContent.match(
                  /<reference\s+[^>]*type=["']cover["'][^>]*href=["']([^"']+)["']/i,
                ) ||
                opfContent.match(
                  /<reference\s+[^>]*href=["']([^"']+)["'][^>]*type=["']cover["']/i,
                );
              if (guideCoverMatch) {
                coverHref = guideCoverMatch[1];
              }
            }

            if (!coverHref) {
              const fallbackIdMatch =
                opfContent.match(
                  /<item\s+[^>]*id=["'](?:cover|cover-image)["'][^>]*href=["']([^"']+)["']/i,
                ) ||
                opfContent.match(
                  /<item\s+[^>]*href=["']([^"']+)["'][^>]*id=["'](?:cover|cover-image)["']/i,
                );
              if (fallbackIdMatch) {
                coverHref = fallbackIdMatch[1];
              }
            }

            if (!coverHref) {
              const fallbackHrefMatch = opfContent.match(
                /<item\s+[^>]*href=["']([^"']*(?:cover|thumbnail)[^"']*\.(?:jpg|jpeg|png|webp))["']/i,
              );
              if (fallbackHrefMatch) {
                coverHref = fallbackHrefMatch[1];
              }
            }

            if (coverHref) {
              let resolvedCoverPath = opfDir + decodeURIComponent(coverHref);

              if (
                resolvedCoverPath.toLowerCase().endsWith(".xhtml") ||
                resolvedCoverPath.toLowerCase().endsWith(".html")
              ) {
                const xhtmlRes = spawnSync(
                  "unzip",
                  ["-p", file, resolvedCoverPath],
                  {
                    stdio: ["ignore", "pipe", "ignore"],
                    encoding: "utf-8",
                  },
                );
                if (xhtmlRes.status === 0 && xhtmlRes.stdout) {
                  const xhtmlContent = xhtmlRes.stdout;
                  const innerImgHref =
                    xhtmlContent.match(
                      /<image\s+[^>]*xlink:href=["']([^"']+)["']/i,
                    )?.[1] ||
                    xhtmlContent.match(
                      /<image\s+[^>]*href=["']([^"']+)["']/i,
                    )?.[1] ||
                    xhtmlContent.match(
                      /<img\s+[^>]*src=["']([^"']+)["']/i,
                    )?.[1];
                  if (innerImgHref) {
                    const xhtmlDir = dirname(resolvedCoverPath);
                    resolvedCoverPath = join(
                      xhtmlDir,
                      decodeURIComponent(innerImgHref),
                    );
                  }
                }
              }

              let cachedExists = false;
              try {
                statSync(cache);
                cachedExists = true;
              } catch {}

              if (!cachedExists) {
                const coverRes = spawnSync(
                  "unzip",
                  ["-p", file, resolvedCoverPath],
                  {
                    stdio: ["ignore", "pipe", "ignore"],
                    encoding: null,
                  },
                );
                if (
                  coverRes.status === 0 &&
                  coverRes.stdout &&
                  coverRes.stdout.length > 0
                ) {
                  writeFileSync(cache, coverRes.stdout);
                  hasCover = true;
                }
              } else {
                hasCover = true;
              }
            }
          }
        }
      }
    } catch {}

    if (hasCover) {
      try {
        renderImage(cache, { yOffset: lineCount, heightOffset: lineCount });
      } catch {
        spawnSync("unzip", ["-l", file], { stdio: "inherit" });
      }
    } else {
      if (lineCount === 0) {
        spawnSync("unzip", ["-l", file], { stdio: "inherit" });
      }
    }
    return;
  }

  if (type.includes("binary") || type.includes("octet-stream")) {
    if (which("hexyl")) {
      spawnSync("hexyl", ["--border", "none", "--length", "1024", file], {
        stdio: "inherit",
      });
    } else {
      spawnSync("file", ["--brief", file], { stdio: "inherit" });
    }
    return;
  }

  const batCmd = which("bat") || which("batcat");
  if (batCmd) {
    let startLine = 0;
    if (center > termHeight / 2)
      startLine = center - Math.floor(termHeight / 2);
    spawnSync(
      batCmd,
      [
        "--style",
        process.env.BAT_STYLE || "numbers,changes",
        "--color=always",
        "--pager=never",
        "--wrap=character",
        `--highlight-line=${center}`,
        `--line-range`,
        `${startLine}:`,
        file,
      ],
      { stdio: "inherit" },
    );
  } else {
    spawnSync("cat", [file], { stdio: "inherit" });
  }
}

if (isMain(import.meta.url)) main();
