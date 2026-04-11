#!/usr/bin/env bun

import { file, write, argv, spawn } from "bun";
import { parse, stringify } from "yaml";
import { availableParallelism } from "os";
import { extname } from "path";

const EXIT_FAILURE = 1;
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

interface FormatResult {
  status: "updated" | "unchanged" | "skipped" | "error";
  elapsed: string;
  error?: unknown;
}

const stats = {
  updated: 0,
  unchanged: 0,
  errors: 0,
  skipped: 0,
};

const outputLock = { locked: false };

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  while (outputLock.locked) await Bun.sleep(1);
  outputLock.locked = true;
  try {
    return await fn();
  } finally {
    outputLock.locked = false;
  }
}

async function main(): Promise<void> {
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

  let completedCount = 0;

  async function worker(): Promise<void> {
    let idx: number;
    while ((idx = completedCount++) < totalFiles) {
      const filePath = targetFiles[idx];

      const startTime = performance.now();
      const startFormatted = new Date().toLocaleTimeString();

      await withLock(async () => {
        process.stdout.write(
          `${COLORS.gray}[${startFormatted}]${COLORS.reset} ${COLORS.bold}START${COLORS.reset}: ${filePath}\n`,
        );
      });

      const handle = file(filePath);
      const exists = await handle.exists();

      if (!exists) {
        const elapsed = (performance.now() - startTime).toFixed(1);
        await withLock(async () => {
          stats.skipped++;
          process.stdout.write(
            `${COLORS.yellow}Skipped${COLORS.reset} (${elapsed}ms): ${filePath} (not found)\n`,
          );
        });
        continue;
      }

      const ext = extname(filePath).toLowerCase();
      const handler = FILE_HANDLERS[ext];
      const externalCmd = FORMATTER_COMMANDS[ext];

      if (!handler && !externalCmd) {
        const elapsed = (performance.now() - startTime).toFixed(1);
        await withLock(async () => {
          stats.skipped++;
          process.stdout.write(
            `${COLORS.yellow}Skipped${COLORS.reset} (${elapsed}ms): ${filePath} (no handler)\n`,
          );
        });
        continue;
      }

      if (handler) {
        try {
          const content = await file(filePath).text();
          const processed = handler.preprocess
            ? handler.preprocess(content)
            : content;

          const prettier = await import("prettier");
          const formatted = await prettier.format(processed, {
            parser: handler.parser,
            plugins: handler.plugins,
            proseWrap: "never",
          });

          const elapsed = (performance.now() - startTime).toFixed(1);

          if (formatted !== content) {
            await write(filePath, formatted);
            await withLock(async () => {
              stats.updated++;
              process.stdout.write(
                `${COLORS.green}Updated${COLORS.reset} (${elapsed}ms): ${filePath}\n`,
              );
            });
          } else {
            await withLock(async () => {
              stats.unchanged++;
              process.stdout.write(
                `${COLORS.cyan}Unchanged${COLORS.reset} (${elapsed}ms): ${filePath}\n`,
              );
            });
          }
        } catch (error) {
          const elapsed = (performance.now() - startTime).toFixed(1);
          await withLock(async () => {
            stats.errors++;
            console.error(error);
            process.stdout.write(
              `${COLORS.red}Error${COLORS.reset} (${elapsed}ms): ${filePath}\n`,
            );
          });
        }
      } else if (externalCmd) {
        try {
          const originalContent = await file(filePath).text();
          const proc = spawn(externalCmd(filePath));
          const exitCode = await proc.exited;

          const finalContent = await file(filePath).text();
          const elapsed = (performance.now() - startTime).toFixed(1);

          const status = finalContent === originalContent ? "unchanged" : "updated";
          await withLock(async () => {
            if (status === "updated") {
              stats.updated++;
              process.stdout.write(
                `${COLORS.green}Updated${COLORS.reset} (${elapsed}ms): ${filePath}\n`,
              );
            } else {
              stats.unchanged++;
              process.stdout.write(
                `${COLORS.cyan}Unchanged${COLORS.reset} (${elapsed}ms): ${filePath}\n`,
              );
            }
          });
        } catch (error) {
          const elapsed = (performance.now() - startTime).toFixed(1);
          await withLock(async () => {
            stats.errors++;
            console.error(error);
            process.stdout.write(
              `${COLORS.red}Error${COLORS.reset} (${elapsed}ms): ${filePath}\n`,
            );
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

  const totalElapsed = (performance.now() - overallStart).toFixed(1);
  process.stdout.write(
    `\n${COLORS.bold}Summary${COLORS.reset} (total: ${totalElapsed}ms):\n`,
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

if (import.meta.main) {
  main();
}
