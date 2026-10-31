#!/usr/bin/env tsx

import {
  existsSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { extname, join, resolve, relative } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { isMain, readStdin, args, which, spawnAsync } from "./utils.ts";

function findPackageInStore(prefix: string): string | null {
  if (!existsSync("/nix/store")) return null;
  try {
    const entries = readdirSync("/nix/store");
    for (const entry of entries) {
      if (
        entry.includes("-" + prefix) &&
        !entry.endsWith(".drv") &&
        !entry.includes("-completions")
      ) {
        return join("/nix/store", entry);
      }
    }
  } catch {}
  return null;
}

function getYamlParser(): {
  parse: typeof import("yaml").parse;
  stringify: typeof import("yaml").stringify;
} {
  try {
    const req = createRequire(import.meta.url);
    return req("yaml");
  } catch {
    const nodePaths = (process.env.NODE_PATH || "").split(":");
    for (const p of nodePaths) {
      if (!p) continue;
      try {
        const req = createRequire(join(p, "dummy.js"));
        return req("yaml");
      } catch {}
    }
    const storeYaml = findPackageInStore("yaml-2.");
    if (storeYaml) {
      try {
        const req = createRequire(join(storeYaml, "lib/node_modules/dummy.js"));
        return req("yaml");
      } catch {}
    }
    throw new Error("Cannot find package 'yaml'");
  }
}

const { parse, stringify } = getYamlParser();

const EXIT_FAILURE = 1;
const PRETTIER_WORKER_ARG = "--prettier-worker";
export const PRETTIER_ENTRYPOINT_ENV = "FORMAT_PRETTIER_ENTRYPOINT";
export const CODE_BLOCK_DELIMITER = /(^`{3,}[\s\S]*?^`{3,})/gm;
export const MARKDOWN_SPECIAL_STRUCTURE =
  /^(#|>|\||\d+\.|\s*(?!--|-{2,})[\*\-+]\s+)/;

export interface FileHandler {
  parser: string;
  plugins?: string[];
  preprocess?: (content: string) => string;
  postprocess?: (content: string) => string;
}

export const FILE_HANDLERS: Record<string, FileHandler> = {
  // Markdown / Text
  ".mdx": { parser: "mdx" },
  ".txt": { parser: "markdown" },

  // Data / Config
  ".yaml": { parser: "yaml" },
  ".yml": { parser: "yaml" },

  // Styles (Sass / Less still handled by Prettier)
  ".scss": { parser: "scss" },
  ".less": { parser: "less" },

  // HTML / Templates / EPUB markup
  ".html": { parser: "html" },
  ".htm": { parser: "html" },
  ".xhtml": { parser: "html" },
  ".vue": { parser: "vue" },
  ".svelte": { parser: "html" },
  ".svg": { parser: "html" },
  ".astro": { parser: "html" },
  ".ejs": { parser: "html" },
  ".hbs": { parser: "glimmer" },
  ".handlebars": { parser: "glimmer" },
  ".pug": { parser: "pug" },

  // GraphQL
  ".graphql": { parser: "graphql" },
  ".gql": { parser: "graphql" },
};

export const FORMATTER_COMMANDS: Record<
  string,
  (filePath: string) => string[]
> = {
  // Markdown (Rumdl - Rust)
  ".md": (fp) => ["rumdl", "fmt", "--silent", fp],
  ".markdown": (fp) => ["rumdl", "fmt", "--silent", fp],

  // JS / TS / Web / JSON / CSS (Biome - Rust)
  ".js": (fp) => ["biome", "format", "--write", fp],
  ".jsx": (fp) => ["biome", "format", "--write", fp],
  ".mjs": (fp) => ["biome", "format", "--write", fp],
  ".cjs": (fp) => ["biome", "format", "--write", fp],
  ".ts": (fp) => ["biome", "format", "--write", fp],
  ".tsx": (fp) => ["biome", "format", "--write", fp],
  ".cts": (fp) => ["biome", "format", "--write", fp],
  ".mts": (fp) => ["biome", "format", "--write", fp],
  ".json": (fp) => ["biome", "format", "--write", fp],
  ".json5": (fp) => ["biome", "format", "--write", fp],
  ".css": (fp) => ["biome", "format", "--write", fp],

  // Nix & Typst (Rust)
  ".nix": (fp) => ["alejandra", "-q", fp],
  ".typ": (fp) => ["typstyle", "-i", "-q", fp],

  // XML / E-books
  ".xml": (fp) => ["xmllint", "--format", "--output", fp, fp],
  ".opf": (fp) => ["xmllint", "--format", "--output", fp, fp],
  ".ncx": (fp) => ["xmllint", "--format", "--output", fp, fp],
  ".toml": (fp) => ["taplo", "format", fp],
  ".ron": (fp) => ["fmtron", "--input", fp],
  ".kdl": (fp) => ["kdlfmt", "format", fp],
  ".rs": (fp) => ["rustfmt", fp],
  ".lua": (fp) => ["stylua", fp],
  ".py": (fp) => ["ruff", "format", fp],
  ".go": (fp) => ["gofmt", "-w", fp],
  ".zig": (fp) => ["zig", "fmt", fp],
  ".cpp": (fp) => ["clang-format", "-i", fp],
  ".cc": (fp) => ["clang-format", "-i", fp],
  ".cxx": (fp) => ["clang-format", "-i", fp],
  ".c": (fp) => ["clang-format", "-i", fp],
  ".h": (fp) => ["clang-format", "-i", fp],
  ".hpp": (fp) => ["clang-format", "-i", fp],
  ".hxx": (fp) => ["clang-format", "-i", fp],
  ".php": (fp) => ["php-cs-fixer", "fix", fp],
  ".blade.php": (fp) => ["blade-formatter", "--write", fp],
  ".rb": (fp) => ["rubocop", "--auto-correct", fp],
  ".java": (fp) => ["google-java-format", "-i", fp],
  ".kt": (fp) => ["ktlint", "-F", fp],
  ".kts": (fp) => ["ktlint", "-F", fp],
  ".cs": (fp) => ["dotnet", "format", fp],
  ".swift": (fp) => ["swiftformat", fp],
  ".dart": (fp) => ["dart", "format", fp],
  ".ex": (fp) => ["mix", "format", fp],
  ".exs": (fp) => ["mix", "format", fp],
  ".erl": (fp) => ["erlfmt", "-w", fp],
  ".hrl": (fp) => ["erlfmt", "-w", fp],
  ".hs": (fp) => ["ormolu", "-i", fp],
  ".clj": (fp) => ["cljfmt", "fix", fp],
  ".cljs": (fp) => ["cljfmt", "fix", fp],
  ".sh": (fp) => ["shfmt", "-w", fp],
  ".bash": (fp) => ["shfmt", "-w", fp],
  ".zsh": (fp) => ["shfmt", "-w", fp],
  ".fish": (fp) => ["fish_indent", "-w", fp],
  ".tf": (fp) => ["terraform", "fmt", fp],
  ".hcl": (fp) => ["terraform", "fmt", fp],
  ".sql": (fp) => ["sql-formatter", "-o", fp, fp],
  ".prisma": (fp) => ["prisma", "format"],
  ".dockerfile": (fp) => ["dockfmt", "format", fp],
  ".proto": (fp) => ["buf", "format", "-w", fp],
  ".slint": (fp) => ["slint-lsp", "format", "-i", fp],
};

export interface BatchFormatterConfig {
  bin: string;
  args: string[];
  supportsBatch: boolean;
}

export const EXTENSION_BATCH_CONFIG: Record<string, BatchFormatterConfig> = {
  // Biome: supports batch file arguments
  ".js": { bin: "biome", args: ["format", "--write"], supportsBatch: true },
  ".jsx": { bin: "biome", args: ["format", "--write"], supportsBatch: true },
  ".mjs": { bin: "biome", args: ["format", "--write"], supportsBatch: true },
  ".cjs": { bin: "biome", args: ["format", "--write"], supportsBatch: true },
  ".ts": { bin: "biome", args: ["format", "--write"], supportsBatch: true },
  ".tsx": { bin: "biome", args: ["format", "--write"], supportsBatch: true },
  ".cts": { bin: "biome", args: ["format", "--write"], supportsBatch: true },
  ".mts": { bin: "biome", args: ["format", "--write"], supportsBatch: true },
  ".json": { bin: "biome", args: ["format", "--write"], supportsBatch: true },
  ".json5": { bin: "biome", args: ["format", "--write"], supportsBatch: true },
  ".css": { bin: "biome", args: ["format", "--write"], supportsBatch: true },

  // Rumdl
  ".md": { bin: "rumdl", args: ["fmt", "--silent"], supportsBatch: true },
  ".markdown": { bin: "rumdl", args: ["fmt", "--silent"], supportsBatch: true },

  // Alejandra (Nix)
  ".nix": { bin: "alejandra", args: ["-q"], supportsBatch: true },

  // Typstyle (Typst)
  ".typ": { bin: "typstyle", args: ["-i", "-q"], supportsBatch: true },

  // Taplo (TOML)
  ".toml": { bin: "taplo", args: ["format"], supportsBatch: true },

  // Stylua (Lua)
  ".lua": { bin: "stylua", args: [], supportsBatch: true },

  // Ruff (Python)
  ".py": { bin: "ruff", args: ["format"], supportsBatch: true },

  // Rustfmt (Rust)
  ".rs": { bin: "rustfmt", args: [], supportsBatch: true },

  // Shfmt (Shell)
  ".sh": { bin: "shfmt", args: ["-w"], supportsBatch: true },
  ".bash": { bin: "shfmt", args: ["-w"], supportsBatch: true },
  ".zsh": { bin: "shfmt", args: ["-w"], supportsBatch: true },

  // Gofmt (Go)
  ".go": { bin: "gofmt", args: ["-w"], supportsBatch: true },

  // Clang-format (C/C++)
  ".c": { bin: "clang-format", args: ["-i"], supportsBatch: true },
  ".cpp": { bin: "clang-format", args: ["-i"], supportsBatch: true },
  ".cc": { bin: "clang-format", args: ["-i"], supportsBatch: true },
  ".cxx": { bin: "clang-format", args: ["-i"], supportsBatch: true },
  ".h": { bin: "clang-format", args: ["-i"], supportsBatch: true },
  ".hpp": { bin: "clang-format", args: ["-i"], supportsBatch: true },
  ".hxx": { bin: "clang-format", args: ["-i"], supportsBatch: true },

  // Google Java Format
  ".java": { bin: "google-java-format", args: ["-i"], supportsBatch: true },

  // Dart
  ".dart": { bin: "dart", args: ["format"], supportsBatch: true },

  // Blade Formatter
  ".blade.php": { bin: "blade-formatter", args: ["--write"], supportsBatch: true },

  // Single file tools (or tools requiring specific positional patterns)
  ".ron": { bin: "fmtron", args: ["--input"], supportsBatch: false },
  ".kdl": { bin: "kdlfmt", args: ["format"], supportsBatch: true },
  ".zig": { bin: "zig", args: ["fmt"], supportsBatch: true },
  ".php": { bin: "php-cs-fixer", args: ["fix"], supportsBatch: true },
  ".rb": { bin: "rubocop", args: ["--auto-correct"], supportsBatch: true },
  ".kt": { bin: "ktlint", args: ["-F"], supportsBatch: true },
  ".kts": { bin: "ktlint", args: ["-F"], supportsBatch: true },
  ".cs": { bin: "dotnet", args: ["format"], supportsBatch: false },
  ".swift": { bin: "swiftformat", args: [], supportsBatch: true },
  ".ex": { bin: "mix", args: ["format"], supportsBatch: true },
  ".exs": { bin: "mix", args: ["format"], supportsBatch: true },
  ".erl": { bin: "erlfmt", args: ["-w"], supportsBatch: true },
  ".hrl": { bin: "erlfmt", args: ["-w"], supportsBatch: true },
  ".hs": { bin: "ormolu", args: ["-i"], supportsBatch: true },
  ".clj": { bin: "cljfmt", args: ["fix"], supportsBatch: true },
  ".cljs": { bin: "cljfmt", args: ["fix"], supportsBatch: true },
  ".fish": { bin: "fish_indent", args: ["-w"], supportsBatch: true },
  ".tf": { bin: "terraform", args: ["fmt"], supportsBatch: true },
  ".hcl": { bin: "terraform", args: ["fmt"], supportsBatch: true },
  ".prisma": { bin: "prisma", args: ["format"], supportsBatch: false },
  ".dockerfile": { bin: "dockfmt", args: ["format"], supportsBatch: true },
  ".proto": { bin: "buf", args: ["format", "-w"], supportsBatch: true },
  ".slint": { bin: "slint-lsp", args: ["format", "-i"], supportsBatch: true },
};

const COLORS = {
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

const SPINNER_FRAMES = ["-", "\\", "|", "/"];
const SPINNER_INTERVAL_MS = 80;

const stats = {
  updated: 0,
  unchanged: 0,
  errors: 0,
  skipped: 0,
};

let prettierModulePromise: Promise<PrettierModule> | undefined;

interface PrettierWorkerResult {
  status: "updated" | "unchanged";
}

interface FormatWithPrettierInSubprocessOptions {
  content: string;
  parser: string;
  plugins?: string[];
}

interface PrettierModule {
  format(
    content: string,
    options: {
      parser: string;
      plugins?: string[];
      proseWrap: "never";
    },
  ): Promise<string>;
}

export function formatElapsedDuration(elapsedMs: number): string {
  if (elapsedMs < 1000) {
    return `${elapsedMs.toFixed(1)}ms`;
  }

  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

export function buildSpinnerLabel(
  activeFiles: string[],
  completedFiles: number,
  totalFiles: number,
): string {
  const currentCount =
    activeFiles.length > 0
      ? Math.min(totalFiles, completedFiles + 1)
      : completedFiles;

  if (activeFiles.length === 0) {
    return `${currentCount}/${totalFiles} formatting`;
  }

  const visibleFiles = activeFiles.slice(0, 2);
  const hiddenCount = activeFiles.length - visibleFiles.length;
  const fileSummary =
    hiddenCount > 0
      ? `${visibleFiles.join(", ")} +${hiddenCount}`
      : visibleFiles.join(", ");

  return `${currentCount}/${totalFiles} formatting: ${fileSummary}`;
}

export function renderSpinnerFrame(
  frameIndex: number,
  activeFiles: string[],
  completedFiles: number,
  totalFiles: number,
): string {
  const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
  const label = buildSpinnerLabel(activeFiles, completedFiles, totalFiles);

  return `\r\x1b[2K${COLORS.gray}${frame}${COLORS.reset} ${label}`;
}

export function renderResultLine(
  status: "Updated" | "Unchanged" | "Skipped" | "Error",
  elapsed: string,
  filePath: string,
  detail?: string,
): string {
  const color =
    status === "Updated"
      ? COLORS.green
      : status === "Unchanged"
        ? COLORS.cyan
        : status === "Skipped"
          ? COLORS.yellow
          : COLORS.red;
  const suffix = detail ? ` (${detail})` : "";

  return `${color}${status}${COLORS.reset} (${elapsed}): ${filePath}${suffix}`;
}

async function getPrettierModule(): Promise<PrettierModule> {
  prettierModulePromise ??= (async () => {
    const specifier = resolvePrettierModuleSpecifier();
    try {
      return (await import(specifier)) as PrettierModule;
    } catch {
      const storePrettier = findPackageInStore("prettier-3.");
      if (storePrettier) {
        const fullPath = join(
          storePrettier,
          "lib/node_modules/prettier/index.mjs",
        );
        return (await import(pathToFileURL(fullPath).href)) as PrettierModule;
      }
      throw new Error(`Cannot load prettier from ${specifier}`);
    }
  })();
  return prettierModulePromise;
}

export function isPrettierWorkerMode(argv: string[] = args): boolean {
  return argv.includes(PRETTIER_WORKER_ARG);
}

export async function formatFileWithPrettier(
  filePath: string,
): Promise<PrettierWorkerResult> {
  const ext = extname(filePath).toLowerCase();
  const handler = FILE_HANDLERS[ext];

  if (!handler) {
    throw new Error(`No Prettier handler for ${filePath}`);
  }

  const originalContent = readFileSync(filePath, "utf-8");
  const processed = handler.preprocess
    ? handler.preprocess(originalContent)
    : originalContent;

  const prettier = await getPrettierModule();
  const formatted = await prettier.format(processed, {
    parser: handler.parser,
    plugins: handler.plugins,
    proseWrap: "never",
  });

  if (formatted !== originalContent) {
    writeFileSync(filePath, formatted, "utf-8");
    return { status: "updated" };
  }

  return { status: "unchanged" };
}

async function runPrettierWorkerCli(argv: string[] = args): Promise<void> {
  const workerIndex = argv.indexOf(PRETTIER_WORKER_ARG);
  const filePath = argv[workerIndex + 1];

  if (!filePath) {
    throw new Error("Missing file path for Prettier worker");
  }

  const result = await formatFileWithPrettier(filePath);
  process.stdout.write(JSON.stringify(result));
}

async function formatFileWithPrettierInSubprocess(
  filePath: string,
): Promise<PrettierWorkerResult> {
  const proc = spawn(
    process.argv[0],
    [fileURLToPath(import.meta.url), PRETTIER_WORKER_ARG, filePath],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let stdout = "";
  let stderr = "";
  proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
  proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
  const exitCode = await new Promise<number>((r) => proc.on("close", r));

  if (exitCode !== 0) {
    throw new Error(
      stderr.trim() || `Prettier worker exited with code ${exitCode}`,
    );
  }

  return JSON.parse(stdout) as PrettierWorkerResult;
}

export async function formatWithPrettierInSubprocess(
  options: FormatWithPrettierInSubprocessOptions,
): Promise<string> {
  const extensionMap: Record<string, string> = {
    markdown: ".txt",
    yaml: ".yaml",
    html: ".html",
    scss: ".scss",
    less: ".less",
  };
  const extension = extensionMap[options.parser] || ".yaml";
  const tempFilePath = join(
    tmpdir(),
    `format-file-${process.pid}-${Date.now()}${extension}`,
  );
  writeFileSync(tempFilePath, options.content, "utf-8");
  try {
    await formatFileWithPrettierInSubprocess(tempFilePath);
    return readFileSync(tempFilePath, "utf-8");
  } finally {
    try {
      rmSync(tempFilePath, { force: true });
    } catch {}
  }
}

function getAllFilesRecursively(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFilesRecursively(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

export async function formatEpubFile(
  filePath: string,
): Promise<PrettierWorkerResult> {
  const absPath = resolve(filePath);
  if (!which("unzip") || !which("zip")) {
    throw new Error("Both 'unzip' and 'zip' are required to format EPUB files.");
  }

  const tempDir = await mkdtemp(join(tmpdir(), "format-epub-"));
  const repackedEpub = join(
    tmpdir(),
    `format-epub-repack-${process.pid}-${Date.now()}.epub`,
  );

  try {
    const extractRes = await spawnAsync(
      "unzip",
      ["-q", "-o", absPath, "-d", tempDir],
    );
    if (extractRes.exitCode !== 0) {
      throw new Error(
        `Failed to extract EPUB: ${extractRes.stderr.trim() || "unzip error"}`,
      );
    }

    const files = getAllFilesRecursively(tempDir);
    let anyUpdated = false;

    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (ext === ".epub") continue;

      const handler = FILE_HANDLERS[ext];
      const externalCmd = FORMATTER_COMMANDS[ext];

      if (handler) {
        try {
          const res = await formatFileWithPrettier(file);
          if (res.status === "updated") {
            anyUpdated = true;
          }
        } catch (err) {
          const rel = relative(tempDir, file);
          throw new Error(
            `Failed formatting ${rel} inside EPUB: ${(err as Error).message}`,
          );
        }
      } else if (externalCmd) {
        const cmd = externalCmd(file);
        if (which(cmd[0])) {
          try {
            const originalContent = readFileSync(file, "utf-8");
            const res = await spawnAsync(cmd[0], cmd.slice(1));
            if (res.exitCode === 0) {
              const finalContent = readFileSync(file, "utf-8");
              if (finalContent !== originalContent) {
                anyUpdated = true;
              }
            } else {
              const rel = relative(tempDir, file);
              throw new Error(
                `Failed formatting ${rel} inside EPUB: ${res.stderr.trim() || `exit code ${res.exitCode}`}`,
              );
            }
          } catch (err) {
            const rel = relative(tempDir, file);
            throw new Error(
              `Failed formatting ${rel} inside EPUB: ${(err as Error).message}`,
            );
          }
        }
      }
    }

    if (!anyUpdated) {
      return { status: "unchanged" };
    }

    const mimePath = join(tempDir, "mimetype");
    const hasMimetype = existsSync(mimePath);
    if (hasMimetype) {
      const mimeContent = readFileSync(mimePath, "utf-8").trim();
      if (mimeContent === "application/epub+zip") {
        writeFileSync(mimePath, "application/epub+zip", "utf-8");
      }
      const zipMimeRes = await spawnAsync(
        "zip",
        ["-0", "-X", "-q", repackedEpub, "mimetype"],
        { cwd: tempDir },
      );
      if (zipMimeRes.exitCode !== 0) {
        throw new Error(
          `Failed to archive mimetype: ${zipMimeRes.stderr.trim()}`,
        );
      }

      const zipRestRes = await spawnAsync(
        "zip",
        ["-r", "-X", "-q", repackedEpub, ".", "-x", "mimetype"],
        { cwd: tempDir },
      );
      if (zipRestRes.exitCode !== 0) {
        throw new Error(
          `Failed to archive EPUB contents: ${zipRestRes.stderr.trim()}`,
        );
      }
    } else {
      const zipAllRes = await spawnAsync(
        "zip",
        ["-r", "-X", "-q", repackedEpub, "."],
        { cwd: tempDir },
      );
      if (zipAllRes.exitCode !== 0) {
        throw new Error(
          `Failed to archive EPUB contents: ${zipAllRes.stderr.trim()}`,
        );
      }
    }

    copyFileSync(repackedEpub, absPath);
    return { status: "updated" };
  } finally {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {}
    if (existsSync(repackedEpub)) {
      try {
        rmSync(repackedEpub, { force: true });
      } catch {}
    }
  }
}

export function printHelp(): void {
  process.stdout.write(`Usage: format [options] <file1> <file2> ...
       cat file-list.txt | format
       find . -name '*.ts' | format

Format source code, markup, configuration files, and EPUB ebooks.

Options:
  -h, --help    Show this help message and exit

Supported Formats:
  Markdown / Text:   .md, .markdown, .mdx, .txt
  Config / Data:     .json, .json5, .yaml, .yml, .toml, .ron, .kdl
  Web / JS / TS:     .js, .jsx, .mjs, .cjs, .ts, .tsx, .cts, .mts,
                     .html, .htm, .xhtml, .vue, .svelte, .css, .scss, .less,
                     .xml, .svg, .astro, .ejs, .hbs, .handlebars, .pug,
                     .graphql, .gql
  E-books:           .epub, .opf, .ncx
  Languages:         .rs, .py, .go, .zig, .nix, .typ, .c, .cpp, .h, .hpp, .cc, .cxx, .hxx,
                     .php, .blade.php, .rb, .java, .kt, .kts, .cs, .swift, .dart,
                     .ex, .exs, .erl, .hrl, .hs, .clj, .cljs,
                     .sh, .bash, .zsh, .fish, .tf, .hcl, .sql, .prisma,
                     .dockerfile, .proto, .slint
`);
}

async function main(): Promise<void> {
  if (isPrettierWorkerMode()) {
    await runPrettierWorkerCli();
    return;
  }

  if (args.includes("-h") || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  const argvFiles = args.filter((arg) => !arg.startsWith("-"));
  let stdinFiles: string[] = [];

  if (!process.stdin.isTTY) {
    const stdinData = await readStdin();
    stdinFiles = stdinData
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("-"));
  }

  const targetFiles = [...new Set([...argvFiles, ...stdinFiles])];

  if (targetFiles.length === 0) {
    console.error("Usage: format [options] <file1> <file2> ...");
    console.error("   or: cat file-list.txt | format");
    console.error("   or: find . -name '*.ts' | format");
    console.error("Run 'format --help' for more information.");
    process.exit(EXIT_FAILURE);
  }

  const overallStart = performance.now();
  const totalFiles = targetFiles.length;
  const activeFiles = new Set<string>();
  const spinnerEnabled = process.stdout.isTTY === true;
  let spinnerFrameIndex = 0;
  let spinnerTimer: ReturnType<typeof setInterval> | undefined;
  let completedFiles = 0;

  function renderSpinner(): void {
    if (!spinnerEnabled || activeFiles.size === 0) {
      return;
    }

    process.stdout.write(
      renderSpinnerFrame(
        spinnerFrameIndex,
        Array.from(activeFiles),
        completedFiles,
        totalFiles,
      ),
    );
    spinnerFrameIndex += 1;
  }

  function clearSpinnerLine(): void {
    if (!spinnerEnabled) {
      return;
    }

    process.stdout.write("\r\x1b[2K");
  }

  function logResult(message: string): void {
    clearSpinnerLine();
    process.stdout.write(`${message}\n`);
    renderSpinner();
  }

  if (spinnerEnabled) {
    spinnerTimer = setInterval(() => {
      renderSpinner();
    }, SPINNER_INTERVAL_MS);
  }

  // Phase 1: Filter files and check existence
  const existingFiles: string[] = [];
  for (const fp of targetFiles) {
    const startTime = performance.now();
    if (!existsSync(fp)) {
      const elapsed = formatElapsedDuration(performance.now() - startTime);
      stats.skipped++;
      completedFiles++;
      logResult(renderResultLine("Skipped", elapsed, fp, "not found"));
      continue;
    }
    existingFiles.push(fp);
  }

  // Phase 2: Group existing files by category/tool
  interface BatchTask {
    key: string;
    bin: string;
    args: string[];
    files: string[];
  }

  const batchTasks = new Map<string, BatchTask>();
  const prettierFiles: string[] = [];
  const epubFiles: string[] = [];
  const singleFileTasks: { fp: string; ext: string }[] = [];

  for (const fp of existingFiles) {
    const ext = extname(fp).toLowerCase();
    if (ext === ".epub") {
      epubFiles.push(fp);
      continue;
    }

    if (FILE_HANDLERS[ext]) {
      prettierFiles.push(fp);
      continue;
    }

    const batchConfig = EXTENSION_BATCH_CONFIG[ext];
    if (batchConfig && batchConfig.supportsBatch) {
      const toolKey = `${batchConfig.bin}:::${batchConfig.args.join(" ")}`;
      let task = batchTasks.get(toolKey);
      if (!task) {
        task = {
          key: toolKey,
          bin: batchConfig.bin,
          args: [...batchConfig.args],
          files: [],
        };
        batchTasks.set(toolKey, task);
      }
      task.files.push(fp);
      continue;
    }

    const fallbackCmd = FORMATTER_COMMANDS[ext];
    if (fallbackCmd) {
      singleFileTasks.push({ fp, ext });
      continue;
    }

    // No handler available
    const startTime = performance.now();
    const elapsed = formatElapsedDuration(performance.now() - startTime);
    stats.skipped++;
    completedFiles++;
    logResult(renderResultLine("Skipped", elapsed, fp, "no handler"));
  }

  // Phase 3: Execute Batch Tasks (The fastest path for Biome, Rumdl, Alejandra, Ruff, etc.)
  for (const task of batchTasks.values()) {
    if (!which(task.bin)) {
      for (const fp of task.files) {
        stats.skipped++;
        completedFiles++;
        logResult(
          renderResultLine(
            "Skipped",
            "0ms",
            fp,
            `${task.bin} binary not in PATH`,
          ),
        );
      }
      continue;
    }

    for (const fp of task.files) {
      activeFiles.add(fp);
    }
    renderSpinner();

    const batchStart = performance.now();
    const originalContents = new Map<string, string>();
    for (const fp of task.files) {
      try {
        originalContents.set(fp, readFileSync(fp, "utf-8"));
      } catch {}
    }

    const spawnArgs = [...task.args, ...task.files];
    const proc = spawn(task.bin, spawnArgs, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    const exitCode = await new Promise<number>((r) => proc.on("close", r));
    const elapsedTotal = formatElapsedDuration(performance.now() - batchStart);

    for (const fp of task.files) {
      activeFiles.delete(fp);
      completedFiles++;

      if (exitCode !== 0) {
        stats.errors++;
        clearSpinnerLine();
        if (stderr.trim()) console.error(stderr.trim());
        logResult(renderResultLine("Error", elapsedTotal, fp));
      } else {
        const prev = originalContents.get(fp);
        let updated = false;
        try {
          const next = readFileSync(fp, "utf-8");
          updated = prev !== next;
        } catch {}

        if (updated) {
          stats.updated++;
          logResult(renderResultLine("Updated", elapsedTotal, fp));
        } else {
          stats.unchanged++;
          logResult(renderResultLine("Unchanged", elapsedTotal, fp));
        }
      }
    }
  }

  // Phase 4: Execute In-Memory Prettier (reusing single loaded instance, no process re-spawn)
  for (const fp of prettierFiles) {
    activeFiles.add(fp);
    renderSpinner();

    const start = performance.now();
    try {
      const result = await formatFileWithPrettier(fp);
      const elapsed = formatElapsedDuration(performance.now() - start);
      activeFiles.delete(fp);
      completedFiles++;

      if (result.status === "updated") {
        stats.updated++;
        logResult(renderResultLine("Updated", elapsed, fp));
      } else {
        stats.unchanged++;
        logResult(renderResultLine("Unchanged", elapsed, fp));
      }
    } catch (err) {
      const elapsed = formatElapsedDuration(performance.now() - start);
      activeFiles.delete(fp);
      stats.errors++;
      completedFiles++;
      clearSpinnerLine();
      console.error(err);
      logResult(renderResultLine("Error", elapsed, fp));
    }
  }

  // Phase 5: Execute Single-file fallback tasks (e.g. xmllint, sql-formatter, ron)
  for (const item of singleFileTasks) {
    const { fp, ext } = item;
    activeFiles.add(fp);
    renderSpinner();

    const start = performance.now();
    const cmdFn = FORMATTER_COMMANDS[ext];
    if (!cmdFn) {
      activeFiles.delete(fp);
      stats.skipped++;
      completedFiles++;
      logResult(renderResultLine("Skipped", "0ms", fp, "no handler"));
      continue;
    }

    const cmd = cmdFn(fp);
    if (!which(cmd[0])) {
      activeFiles.delete(fp);
      stats.skipped++;
      completedFiles++;
      logResult(
        renderResultLine("Skipped", "0ms", fp, `${cmd[0]} not in PATH`),
      );
      continue;
    }

    try {
      let originalContent = "";
      try {
        originalContent = readFileSync(fp, "utf-8");
      } catch {}

      const res = await spawnAsync(cmd[0], cmd.slice(1));
      const elapsed = formatElapsedDuration(performance.now() - start);
      activeFiles.delete(fp);
      completedFiles++;

      if (res.exitCode !== 0) {
        stats.errors++;
        clearSpinnerLine();
        if (res.stderr.trim()) console.error(res.stderr.trim());
        logResult(renderResultLine("Error", elapsed, fp));
      } else {
        let finalContent = "";
        try {
          finalContent = readFileSync(fp, "utf-8");
        } catch {}
        if (finalContent !== originalContent) {
          stats.updated++;
          logResult(renderResultLine("Updated", elapsed, fp));
        } else {
          stats.unchanged++;
          logResult(renderResultLine("Unchanged", elapsed, fp));
        }
      }
    } catch (err) {
      const elapsed = formatElapsedDuration(performance.now() - start);
      activeFiles.delete(fp);
      stats.errors++;
      completedFiles++;
      clearSpinnerLine();
      console.error(err);
      logResult(renderResultLine("Error", elapsed, fp));
    }
  }

  // Phase 6: Execute EPUB Files
  for (const fp of epubFiles) {
    activeFiles.add(fp);
    renderSpinner();

    const start = performance.now();
    try {
      const result = await formatEpubFile(fp);
      const elapsed = formatElapsedDuration(performance.now() - start);
      activeFiles.delete(fp);
      completedFiles++;

      if (result.status === "updated") {
        stats.updated++;
        logResult(renderResultLine("Updated", elapsed, fp));
      } else {
        stats.unchanged++;
        logResult(renderResultLine("Unchanged", elapsed, fp));
      }
    } catch (err) {
      const elapsed = formatElapsedDuration(performance.now() - start);
      activeFiles.delete(fp);
      stats.errors++;
      completedFiles++;
      clearSpinnerLine();
      console.error(err);
      logResult(renderResultLine("Error", elapsed, fp));
    }
  }

  if (spinnerTimer) {
    clearInterval(spinnerTimer);
  }
  clearSpinnerLine();

  const totalElapsed = formatElapsedDuration(performance.now() - overallStart);
  process.stdout.write(
    `\n${COLORS.bold}Summary${COLORS.reset} (total: ${totalElapsed}):\n`,
  );
  process.stdout.write(
    `  ${COLORS.green}${stats.updated} updated${COLORS.reset}\n`,
  );
  process.stdout.write(
    `  ${COLORS.cyan}${stats.unchanged} unchanged${COLORS.reset}\n`,
  );
  process.stdout.write(
    `  ${COLORS.red}${stats.errors} errors${COLORS.reset}\n`,
  );
  process.stdout.write(
    `  ${COLORS.yellow}${stats.skipped} skipped${COLORS.reset}\n`,
  );
}

export function processMarkdownContent(content: string): string {
  const { yamlHeader, body } = extractAndNormalizeFrontMatter(content);
  const segments = body.split(CODE_BLOCK_DELIMITER);
  const formattedBody = segments
    .map((segment) =>
      isCodeBlock(segment) ? segment : injectParagraphBreaks(segment),
    )
    .join("");
  return yamlHeader + "\n\n" + formattedBody;
}

export function extractAndNormalizeFrontMatter(content: string): {
  yamlHeader: string;
  body: string;
} {
  if (!content.startsWith("---")) {
    return { yamlHeader: "", body: content };
  }

  const frontMatterPattern = /^---\s*([\s\S]*?)\n---\n?/;
  const match = content.match(frontMatterPattern);

  if (!match) {
    return { yamlHeader: "", body: content };
  }

  const rawYaml = match[1].trim();
  const body = content.slice(match[0].length);

  try {
    const sanitizedYaml = attemptYamlRepair(rawYaml);
    const parsed = parse(sanitizedYaml);

    const normalizedYaml = stringify(parsed, {
      indent: 2,
      lineWidth: 0,
      defaultStringType: "PLAIN",
      defaultKeyType: "PLAIN",
    });

    const bodyWithSpacing = body ? "\n" + body : "";

    return {
      yamlHeader: `---\n${normalizedYaml}---`,
      body: bodyWithSpacing,
    };
  } catch {
    return { yamlHeader: match[0], body: body };
  }
}

export function attemptYamlRepair(rawYaml: string): string {
  if (!rawYaml.includes("\n") && rawYaml.includes(":")) {
    return rawYaml.replace(/(\w+):/g, "\n$1:").trim();
  }
  return rawYaml;
}

export function injectParagraphBreaks(text: string): string {
  const lines = text.split("\n");
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const nextLine = lines[i + 1];

    processedLines.push(currentLine);

    if (shouldAddSpacing(currentLine, nextLine)) {
      processedLines.push("");
    }
  }

  return processedLines.join("\n");
}

export function shouldAddSpacing(
  current: string,
  next: string | undefined,
): boolean {
  if (next === undefined) return false;

  const currentTrimmed = current.trim();
  const nextTrimmed = next.trim();

  if (!currentTrimmed || !nextTrimmed) return false;

  const isCurrentStructural = MARKDOWN_SPECIAL_STRUCTURE.test(currentTrimmed);
  const isNextStructural = MARKDOWN_SPECIAL_STRUCTURE.test(nextTrimmed);

  return !isCurrentStructural && !isNextStructural;
}

export function isCodeBlock(segment: string): boolean {
  return /^`{3,}/.test(segment);
}

export function resolvePrettierModuleSpecifier(
  env: Record<string, string | undefined> = process.env,
): string {
  const entrypoint = env[PRETTIER_ENTRYPOINT_ENV];
  return entrypoint ? pathToFileURL(entrypoint).href : "prettier";
}

if (isMain(import.meta.url)) {
  main();
}
