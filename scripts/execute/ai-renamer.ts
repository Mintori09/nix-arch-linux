#!/usr/bin/env tsx

import { statSync, readFileSync, existsSync } from "node:fs";
import { rename, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import * as readline from "node:readline";
import { args, isMain } from "./utils.ts";

export interface CliOptions {
  targets: string[];
  prompt?: string;
  model: string;
  caseStyle?: "kebab" | "snake" | "camel" | "pascal" | "lower" | "preserve";
  dryRun: boolean;
  yes: boolean;
  recursive: boolean;
  includeContent: boolean;
  verbose: boolean;
  help: boolean;
}

export interface FileItem {
  path: string;
  dir: string;
  originalName: string;
  extension: string;
  sizeBytes: number;
  contentSnippet?: string;
}

export interface RenameProposal {
  originalPath: string;
  originalName: string;
  suggestedName: string;
  newPath: string;
  reason?: string;
  changed: boolean;
}

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".csv",
  ".tsv",
  ".xml",
  ".html",
  ".css",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".py",
  ".sh",
  ".bash",
  ".zsh",
  ".nix",
  ".rs",
  ".go",
  ".c",
  ".cpp",
  ".h",
  ".java",
  ".kt",
  ".lua",
  ".sql",
  ".log",
  ".env",
]);

export function parseArgs(rawArgs: string[]): CliOptions {
  const options: CliOptions = {
    targets: [],
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    dryRun: false,
    yes: false,
    recursive: false,
    includeContent: true,
    verbose: false,
    help: false,
  };

  let i = 0;
  while (i < rawArgs.length) {
    const arg = rawArgs[i];

    if (arg === "-h" || arg === "--help") {
      options.help = true;
      i++;
    } else if (arg === "-n" || arg === "-d" || arg === "--dry-run") {
      options.dryRun = true;
      i++;
    } else if (arg === "-y" || arg === "--yes") {
      options.yes = true;
      i++;
    } else if (arg === "-r" || arg === "--recursive") {
      options.recursive = true;
      i++;
    } else if (arg === "-v" || arg === "--verbose") {
      options.verbose = true;
      i++;
    } else if (arg === "--no-content") {
      options.includeContent = false;
      i++;
    } else if (arg === "-c" || arg === "--content") {
      options.includeContent = true;
      i++;
    } else if (arg === "-p" || arg === "--prompt" || arg === "--hint") {
      options.prompt = rawArgs[i + 1];
      i += 2;
    } else if (arg === "-m" || arg === "--model") {
      options.model = rawArgs[i + 1] || DEFAULT_MODEL;
      i += 2;
    } else if (arg === "--case") {
      const style = rawArgs[i + 1]?.toLowerCase() as CliOptions["caseStyle"];
      if (
        ["kebab", "snake", "camel", "pascal", "lower", "preserve"].includes(
          style as string,
        )
      ) {
        options.caseStyle = style;
      }
      i += 2;
    } else if (arg.startsWith("-")) {
      console.warn(`\x1b[33mWarning: Skipping unknown option '${arg}'\x1b[0m`);
      i++;
    } else {
      options.targets.push(arg);
      i++;
    }
  }

  return options;
}

export function printHelp(): void {
  console.log(`
\x1b[1m\x1b[36mai-renamer\x1b[0m — Smart file renamer powered by Google Gemini API

\x1b[1mUSAGE:\x1b[0m
  ai-renamer [options] <files/directories...>

\x1b[1mOPTIONS:\x1b[0m
  \x1b[32m-p, --prompt, --hint <text>\x1b[0m   Custom instruction / naming style hint (e.g. "kebab-case", "include date", "concise summary")
  \x1b[32m-n, -d, --dry-run\x1b[0m             Preview proposed renames without modifying files on disk
  \x1b[32m-y, --yes\x1b[0m                     Automatically apply renames without interactive confirmation
  \x1b[32m-r, --recursive\x1b[0m               Recursively scan subdirectories when targets are directories
  \x1b[32m-m, --model <name>\x1b[0m            Choose Gemini model (default: gemini-3.5-flash-lite)
  \x1b[32m--case <style>\x1b[0m                Enforce case convention: kebab, snake, camel, pascal, lower, preserve
  \x1b[32m--no-content\x1b[0m                  Do not read text file content snippets for context
  \x1b[32m-v, --verbose\x1b[0m                 Print detailed debug info and prompt contents
  \x1b[32m-h, --help\x1b[0m                    Show this help message

\x1b[1mEXAMPLES:\x1b[0m
  \x1b[90m# Rename a messy download file\x1b[0m
  ai-renamer messy_download_file_123.pdf

  \x1b[90m# Batch rename with a style hint\x1b[0m
  ai-renamer -p "kebab-case, concise, clean" *.png

  \x1b[90m# Dry run preview on downloads folder\x1b[0m
  ai-renamer --dry-run ~/Downloads/*

  \x1b[90m# Rename based on file content\x1b[0m
  ai-renamer -p "extract lecture topic into concise title" meeting_notes_draft.txt

\x1b[1mENVIRONMENT VARIABLES:\x1b[0m
  \x1b[33mGEMINI_API_KEY\x1b[0m or \x1b[33mGOOGLE_API_KEY\x1b[0m : Google AI Studio API key
`);
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|\x00-\x1f]/g, "")
    .trim()
    .replace(/\.+$/, "");
}

export function readSnippet(
  filePath: string,
  maxBytes = 2048,
): string | undefined {
  try {
    const ext = extname(filePath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) return undefined;

    const stat = statSync(filePath);
    if (stat.isDirectory() || stat.size === 0) return undefined;

    const fd = readFileSync(filePath, { encoding: "utf-8" });
    const clean = fd.slice(0, maxBytes).replace(/\r\n/g, "\n").trim();
    return clean.length > 0 ? clean : undefined;
  } catch {
    return undefined;
  }
}

export async function collectFiles(
  targets: string[],
  recursive: boolean,
): Promise<string[]> {
  const result: string[] = [];

  for (const target of targets) {
    if (!existsSync(target)) {
      console.warn(
        `\x1b[33mWarning: Target '${target}' not found, skipping.\x1b[0m`,
      );
      continue;
    }

    try {
      const fileStat = await stat(target);
      if (fileStat.isFile()) {
        result.push(resolve(target));
      } else if (fileStat.isDirectory()) {
        const entries = await readdir(target, {
          withFileTypes: true,
          recursive,
        });
        for (const entry of entries) {
          if (entry.isFile()) {
            const fullPath = entry.parentPath
              ? join(entry.parentPath, entry.name)
              : join(target, entry.name);
            result.push(resolve(fullPath));
          }
        }
      }
    } catch (err: any) {
      console.warn(
        `\x1b[33mWarning: Failed to read '${target}': ${err.message}\x1b[0m`,
      );
    }
  }

  return Array.from(new Set(result));
}

export function buildGeminiPrompt(
  files: FileItem[],
  customPrompt?: string,
  caseStyle?: string,
): string {
  const fileDescriptions = files
    .map((f, index) => {
      let desc = `File ${index + 1}:\n- Original Name: "${f.originalName}"\n- Extension: "${f.extension}"\n- Size: ${f.sizeBytes} bytes`;
      if (f.contentSnippet) {
        desc += `\n- Content preview:\n"""\n${f.contentSnippet}\n"""`;
      }
      return desc;
    })
    .join("\n\n");

  let instructions = `You are a precision file renaming assistant.
Your task is to analyze the original filenames (and content previews where provided) and suggest clean, concise, meaningful, descriptive, and human-readable filenames.

Rules:
1. Preserve original file extensions exactly (e.g. .png, .pdf, .ts).
2. Remove ugly clutter, random hash strings, download timestamps, duplicate indicators like (1), "[1080p]", "HD", "final_v2_edit", etc., unless they are essential.
3. Keep the name concise and descriptive.
4. Do NOT include path slashes, illegal filesystem characters (/, \\, :, *, ?, ", <, >, |).
5. Output valid JSON in the exact schema requested.`;

  if (caseStyle) {
    instructions += `\n6. Format all suggested filenames in '${caseStyle}' style (e.g. kebab-case: my-file-name.ext, snake_case: my_file_name.ext).`;
  }

  if (customPrompt) {
    instructions += `\n\nUser specific instruction / style requirements:\n"${customPrompt}"`;
  }

  instructions += `\n\nInput files to rename:\n${fileDescriptions}\n\nRespond ONLY with a JSON array of objects with keys: "originalName", "suggestedName", and "reason".`;

  return instructions;
}

export async function queryGemini(
  prompt: string,
  apiKey: string,
  model: string,
): Promise<
  Array<{ originalName: string; suggestedName: string; reason?: string }>
> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Google Gemini API error (HTTP ${response.status}): ${errorBody}`,
    );
  }

  const data = (await response.json()) as any;
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("No valid response content received from Gemini API.");
  }

  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) {
      return parsed;
    } else if (parsed.files && Array.isArray(parsed.files)) {
      return parsed.files;
    } else if (parsed.renames && Array.isArray(parsed.renames)) {
      return parsed.renames;
    }
    throw new Error("JSON response is not a valid array.");
  } catch (err: any) {
    throw new Error(
      `Failed to parse AI JSON response: ${err.message}\nRaw: ${rawText}`,
    );
  }
}

export function resolveCollisions(
  files: FileItem[],
  aiSuggestions: Array<{
    originalName: string;
    suggestedName: string;
    reason?: string;
  }>,
): RenameProposal[] {
  const suggestionMap = new Map<
    string,
    { suggested: string; reason?: string }
  >();
  for (const s of aiSuggestions) {
    if (s && s.originalName && s.suggestedName) {
      suggestionMap.set(s.originalName, {
        suggested: sanitizeFilename(s.suggestedName),
        reason: s.reason,
      });
    }
  }

  const proposals: RenameProposal[] = [];
  const allocatedPaths = new Set<string>();

  for (const file of files) {
    const ai = suggestionMap.get(file.originalName);
    let targetName = ai?.suggested || file.originalName;

    // Ensure extension is preserved if AI accidentally dropped it
    if (
      file.extension &&
      !targetName.toLowerCase().endsWith(file.extension.toLowerCase())
    ) {
      targetName = `${targetName}${file.extension}`;
    }

    let targetPath = join(file.dir, targetName);

    // If destination already exists on disk (and isn't the file itself) or was allocated in this batch
    if (
      (existsSync(targetPath) && targetPath !== file.path) ||
      allocatedPaths.has(targetPath)
    ) {
      const ext = extname(targetName);
      const base = basename(targetName, ext);
      let counter = 1;
      while (
        (existsSync(join(file.dir, `${base}-${counter}${ext}`)) &&
          join(file.dir, `${base}-${counter}${ext}`) !== file.path) ||
        allocatedPaths.has(join(file.dir, `${base}-${counter}${ext}`))
      ) {
        counter++;
      }
      targetName = `${base}-${counter}${ext}`;
      targetPath = join(file.dir, targetName);
    }

    allocatedPaths.add(targetPath);

    proposals.push({
      originalPath: file.path,
      originalName: file.originalName,
      suggestedName: targetName,
      newPath: targetPath,
      reason: ai?.reason,
      changed: targetName !== file.originalName,
    });
  }

  return proposals;
}

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      res(trimmed === "y" || trimmed === "yes");
    });
  });
}

export async function main(): Promise<void> {
  const options = parseArgs(args);

  if (options.help || (options.targets.length === 0 && process.stdin.isTTY)) {
    printHelp();
    process.exit(0);
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) {
    console.error(`\x1b[31m✕ Error:\x1b[0m Google API Key not found.`);
    console.error(
      `Please set \x1b[33mGEMINI_API_KEY\x1b[0m or \x1b[33mGOOGLE_API_KEY\x1b[0m environment variable.`,
    );
    console.error(`Example: export GEMINI_API_KEY="AIzaSy..."\n`);
    process.exit(1);
  }

  // If no targets provided in args, check if paths are piped via stdin
  if (options.targets.length === 0 && !process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    const lines = Buffer.concat(chunks)
      .toString("utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    options.targets.push(...lines);
  }

  if (options.targets.length === 0) {
    console.error("\x1b[31m✕ Error:\x1b[0m No files specified to rename.");
    process.exit(1);
  }

  console.log(`\x1b[36m🔍 Scanning targets...\x1b[0m`);
  const filePaths = await collectFiles(options.targets, options.recursive);

  if (filePaths.length === 0) {
    console.log("No valid files found.");
    process.exit(0);
  }

  console.log(
    `\x1b[32m✔\x1b[0m Found \x1b[1m${filePaths.length}\x1b[0m file(s).`,
  );

  const fileItems: FileItem[] = filePaths.map((fp) => {
    const fileStat = statSync(fp);
    const originalName = basename(fp);
    const extension = extname(fp);
    const snippet = options.includeContent ? readSnippet(fp) : undefined;

    return {
      path: fp,
      dir: dirname(fp),
      originalName,
      extension,
      sizeBytes: fileStat.size,
      contentSnippet: snippet,
    };
  });

  console.log(`\x1b[36m🤖 Analyzing with Gemini (${options.model})...\x1b[0m`);

  // Batch process in chunks of 25 to ensure reliable responses
  const BATCH_SIZE = 25;
  const allSuggestions: Array<{
    originalName: string;
    suggestedName: string;
    reason?: string;
  }> = [];

  for (let i = 0; i < fileItems.length; i += BATCH_SIZE) {
    const batch = fileItems.slice(i, i + BATCH_SIZE);
    const prompt = buildGeminiPrompt(batch, options.prompt, options.caseStyle);

    if (options.verbose) {
      console.log(
        `\x1b[90m--- Prompt (Batch ${Math.floor(i / BATCH_SIZE) + 1}) ---\n${prompt}\n--------------------\x1b[0m`,
      );
    }

    try {
      const suggestions = await queryGemini(prompt, apiKey, options.model);
      allSuggestions.push(...suggestions);
    } catch (err: any) {
      console.error(`\x1b[31m✕ Gemini API Error:\x1b[0m ${err.message}`);
      process.exit(1);
    }
  }

  const proposals = resolveCollisions(fileItems, allSuggestions);
  const changedProposals = proposals.filter((p) => p.changed);

  console.log(`\n\x1b[1m📋 PROPOSED RENAMES:\x1b[0m`);
  console.log("━".repeat(80));

  for (const p of proposals) {
    if (p.changed) {
      console.log(`\x1b[31m- ${p.originalName}\x1b[0m`);
      console.log(
        `\x1b[32m+ ${p.suggestedName}\x1b[0m ${p.reason ? `\x1b[90m(${p.reason})\x1b[0m` : ""}`,
      );
    } else {
      console.log(`\x1b[90m= ${p.originalName} (unchanged)\x1b[0m`);
    }
    console.log("─".repeat(80));
  }

  console.log(
    `Total: \x1b[1m${proposals.length}\x1b[0m | To rename: \x1b[1m\x1b[32m${changedProposals.length}\x1b[0m | Unchanged: \x1b[1m${proposals.length - changedProposals.length}\x1b[0m\n`,
  );

  if (changedProposals.length === 0) {
    console.log("No files need renaming.");
    process.exit(0);
  }

  if (options.dryRun) {
    console.log(
      "\x1b[33mℹ Dry run mode enabled. No changes were written to disk.\x1b[0m",
    );
    process.exit(0);
  }

  let shouldApply = options.yes;
  if (!shouldApply) {
    shouldApply = await askConfirmation(
      `Apply these renames to ${changedProposals.length} file(s)? [y/N]: `,
    );
  }

  if (!shouldApply) {
    console.log("Renaming cancelled.");
    process.exit(0);
  }

  let successCount = 0;
  let errorCount = 0;

  for (const p of changedProposals) {
    try {
      await rename(p.originalPath, p.newPath);
      successCount++;
    } catch (err: any) {
      errorCount++;
      console.error(
        `\x1b[31m✕ Error renaming '${p.originalName}' -> '${p.suggestedName}': ${err.message}\x1b[0m`,
      );
    }
  }

  console.log(
    `\n\x1b[32m✔ Completed!\x1b[0m Successfully renamed \x1b[1m${successCount}\x1b[0m file(s)${errorCount > 0 ? `, \x1b[31m${errorCount} error(s)\x1b[0m` : ""}.`,
  );
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error("\x1b[31mFatal error:\x1b[0m", err);
    process.exit(1);
  });
}
