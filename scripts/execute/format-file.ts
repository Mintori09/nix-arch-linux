#!/usr/bin/env bun

import { file, write, argv, spawn } from "bun";
import { parse, stringify } from "yaml";
import { availableParallelism } from "os";
import { extname } from "path";
import { pathToFileURL } from "url";

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
  // Markdown
  ".md": {
    parser: "markdown",
    preprocess: processMarkdownContent,
  },
  ".markdown": {
    parser: "markdown",
    preprocess: processMarkdownContent,
  },
  ".mdx": { parser: "mdx" },
  ".txt": { parser: "markdown" },

  // Data / Config
  ".yaml": { parser: "yaml" },
  ".yml": { parser: "yaml" },
  ".json": { parser: "json" },
  ".json5": { parser: "json5" },

  // JavaScript / TypeScript
  ".ts": { parser: "typescript" },
  ".tsx": { parser: "typescript" },
  ".js": { parser: "babel" },
  ".jsx": { parser: "babel" },
  ".mjs": { parser: "babel" },
  ".cjs": { parser: "babel" },
  ".cts": { parser: "typescript" },
  ".mts": { parser: "typescript" },

  // Styles
  ".css": { parser: "css" },
  ".scss": { parser: "scss" },
  ".less": { parser: "less" },

  // HTML / Templates
  ".html": { parser: "html" },
  ".htm": { parser: "html" },
  ".vue": { parser: "vue" },
  ".svelte": { parser: "html" },
  ".xml": { parser: "html" },
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
  ".toml": (fp) => ["taplo", "format", fp],
  ".ron": (fp) => ["fmtron", "--input", fp],
  ".kdl": (fp) => ["kdlfmt", "format", fp],
  ".rs": (fp) => ["rustfmt", fp],
  ".lua": (fp) => ["stylua", fp],
  ".py": (fp) => ["ruff", "format", fp],
  ".go": (fp) => ["gofmt", "-w", fp],
  ".zig": (fp) => ["zig", "fmt", fp],
  ".nix": (fp) => ["nixfmt", fp],
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

const outputLock = { locked: false };
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

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  while (outputLock.locked) await Bun.sleep(1);
  outputLock.locked = true;
  try {
    return await fn();
  } finally {
    outputLock.locked = false;
  }
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
  prettierModulePromise ??= import(
    resolvePrettierModuleSpecifier()
  ) as Promise<PrettierModule>;
  return prettierModulePromise;
}

export function isPrettierWorkerMode(args: string[] = argv): boolean {
  return args.includes(PRETTIER_WORKER_ARG);
}

async function runPrettierWorker(filePath: string): Promise<PrettierWorkerResult> {
  const ext = extname(filePath).toLowerCase();
  const handler = FILE_HANDLERS[ext];

  if (!handler) {
    throw new Error(`No Prettier handler for ${filePath}`);
  }

  const originalContent = await file(filePath).text();
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
    await write(filePath, formatted);
    return { status: "updated" };
  }

  return { status: "unchanged" };
}

async function runPrettierWorkerCli(args: string[] = argv): Promise<void> {
  const workerIndex = args.indexOf(PRETTIER_WORKER_ARG);
  const filePath = args[workerIndex + 1];

  if (!filePath) {
    throw new Error("Missing file path for Prettier worker");
  }

  const result = await runPrettierWorker(filePath);
  process.stdout.write(JSON.stringify(result));
}

async function formatFileWithPrettierInSubprocess(
  filePath: string,
): Promise<PrettierWorkerResult> {
  const proc = Bun.spawn([process.execPath, import.meta.path, PRETTIER_WORKER_ARG, filePath], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `Prettier worker exited with code ${exitCode}`);
  }

  return JSON.parse(stdout) as PrettierWorkerResult;
}

export async function formatWithPrettierInSubprocess(
  options: FormatWithPrettierInSubprocessOptions,
): Promise<string> {
  const extension = options.parser === "markdown" ? ".md" : ".txt";
  const tempFilePath = `/tmp/format-file-${process.pid}-${Date.now()}${extension}`;
  await write(tempFilePath, options.content);
  const result = await formatFileWithPrettierInSubprocess(tempFilePath);
  void result;
  return file(tempFilePath).text();
}

async function main(): Promise<void> {
  if (isPrettierWorkerMode()) {
    await runPrettierWorkerCli();
    return;
  }

  const argvFiles = argv.slice(2);
  let stdinFiles: string[] = [];

  if (!process.stdin.isTTY) {
    const stdinData = await Bun.stdin.text();
    stdinFiles = stdinData
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  const targetFiles = [...new Set([...argvFiles, ...stdinFiles])];

  if (targetFiles.length === 0) {
    console.error("Usage: bun run format.ts <file1> <file2> ...");
    console.error("   or: cat file-list.txt | bun run format.ts");
    console.error("   or: find . -name '*.ts' | bun run format.ts");
    process.exit(EXIT_FAILURE);
  }

  const overallStart = performance.now();
  const maxConcurrency = Math.min(availableParallelism(), targetFiles.length);
  const totalFiles = targetFiles.length;
  const activeFiles = new Set<string>();
  const spinnerEnabled = process.stdout.isTTY;
  let spinnerFrameIndex = 0;
  let spinnerTimer: ReturnType<typeof setInterval> | undefined;

  let nextFileIndex = 0;
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

  async function logResult(message: string): Promise<void> {
    await withLock(async () => {
      clearSpinnerLine();
      process.stdout.write(`${message}\n`);
      renderSpinner();
    });
  }

  if (spinnerEnabled) {
    spinnerTimer = setInterval(() => {
      void withLock(async () => {
        renderSpinner();
      });
    }, SPINNER_INTERVAL_MS);
  }

  async function worker(): Promise<void> {
    let idx: number;
    while ((idx = nextFileIndex++) < totalFiles) {
      const filePath = targetFiles[idx];
      activeFiles.add(filePath);
      await withLock(async () => {
        renderSpinner();
      });

      const startTime = performance.now();
      const handle = file(filePath);
      const exists = await handle.exists();

      if (!exists) {
        const elapsed = formatElapsedDuration(performance.now() - startTime);
        activeFiles.delete(filePath);
        stats.skipped++;
        completedFiles++;
        await logResult(renderResultLine("Skipped", elapsed, filePath, "not found"));
        continue;
      }

      const ext = extname(filePath).toLowerCase();
      const handler = FILE_HANDLERS[ext];
      const externalCmd = FORMATTER_COMMANDS[ext];

      if (!handler && !externalCmd) {
        const elapsed = formatElapsedDuration(performance.now() - startTime);
        activeFiles.delete(filePath);
        stats.skipped++;
        completedFiles++;
        await logResult(
          renderResultLine("Skipped", elapsed, filePath, "no handler"),
        );
        continue;
      }

      if (handler) {
        try {
          const result = await formatFileWithPrettierInSubprocess(filePath);
          const elapsed = formatElapsedDuration(performance.now() - startTime);
          activeFiles.delete(filePath);
          completedFiles++;

          if (result.status === "updated") {
            stats.updated++;
            await logResult(renderResultLine("Updated", elapsed, filePath));
          } else {
            stats.unchanged++;
            await logResult(renderResultLine("Unchanged", elapsed, filePath));
          }
        } catch (error) {
          const elapsed = formatElapsedDuration(performance.now() - startTime);
          activeFiles.delete(filePath);
          stats.errors++;
          completedFiles++;
          await withLock(async () => {
            clearSpinnerLine();
            console.error(error);
            process.stdout.write(`${renderResultLine("Error", elapsed, filePath)}\n`);
            renderSpinner();
          });
        }
      } else if (externalCmd) {
        try {
          const originalContent = await file(filePath).text();
          const proc = spawn(externalCmd(filePath));
          const exitCode = await proc.exited;
          void exitCode;

          const finalContent = await file(filePath).text();
          const elapsed = formatElapsedDuration(performance.now() - startTime);
          activeFiles.delete(filePath);
          completedFiles++;

          const status =
            finalContent === originalContent ? "unchanged" : "updated";
          if (status === "updated") {
            stats.updated++;
            await logResult(renderResultLine("Updated", elapsed, filePath));
          } else {
            stats.unchanged++;
            await logResult(renderResultLine("Unchanged", elapsed, filePath));
          }
        } catch (error) {
          const elapsed = formatElapsedDuration(performance.now() - startTime);
          activeFiles.delete(filePath);
          stats.errors++;
          completedFiles++;
          await withLock(async () => {
            clearSpinnerLine();
            console.error(error);
            process.stdout.write(`${renderResultLine("Error", elapsed, filePath)}\n`);
            renderSpinner();
          });
        }
      }
    }
  }

  const tasks: Promise<void>[] = [];
  for (let i = 0; i < maxConcurrency; i++) {
    tasks.push(worker());
  }

  await Promise.all(tasks);

  if (spinnerTimer) {
    clearInterval(spinnerTimer);
  }

  await withLock(async () => {
    clearSpinnerLine();
  });

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
  env: NodeJS.ProcessEnv = process.env,
): string {
  const entrypoint = env[PRETTIER_ENTRYPOINT_ENV];
  return entrypoint ? pathToFileURL(entrypoint).href : "prettier";
}

if (import.meta.main) {
  main();
}
