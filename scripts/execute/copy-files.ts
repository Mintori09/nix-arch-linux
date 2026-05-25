#!/usr/bin/env tsx
import { existsSync, readFileSync, realpathSync } from "fs";
import { basename, relative } from "path";
import { homedir } from "os";
import { spawn } from "node:child_process";

import { fileGroupNames, fileGroups } from "./file-groups";
import { isMain, readStdin } from "./utils";

const SHELL_UNSAFE_PATH_PATTERN = /[\s"'`$!&;|<>(){}\[\]*?~#]/;
const HOME_DIR = homedir();

type FileGroupName = keyof typeof fileGroups;
type Selector = "all" | FileGroupName;
const TYPE_GROUPS: FileGroupName[] = ["images", "subtitles", "text"];

type ContentPathMode = "only-name" | "fullpath" | "relative" | "none";

type ParsedArgs = {
  copyContent: boolean;
  contentPathMode: ContentPathMode;
  dryRun: boolean;
  files: string[];
  gitUntracked: boolean;
  homeRelative: boolean;
  randomCount: number | null;
  recursive: boolean;
  selectors: Selector[];
  separator: string;
  useBasename: boolean;
  useQuotes: boolean;
};

type DisplayPathOptions = {
  alwaysQuote?: boolean;
  homeRelative?: boolean;
};

export function shouldQuotePath(path: string): boolean {
  return SHELL_UNSAFE_PATH_PATTERN.test(path);
}

export function quotePath(path: string): string {
  const escapedPath = path.replace(/["\\$`!]/g, "\\$&");
  return `"${escapedPath}"`;
}

export function escapeShellPath(path: string): string {
  return path.replace(/([\s"'`$!&;|<>(){}\[\]*?#\\])/g, "\\$1");
}

export function formatHomeRelativePath(path: string): string {
  const relPath = relative(HOME_DIR, path);

  if (
    relPath.startsWith("..") ||
    relPath === "." ||
    relPath.includes(`..${path.includes("\\") ? "\\" : "/"}`)
  ) {
    return path;
  }

  return relPath === "" ? "~" : `~/${escapeShellPath(relPath)}`;
}

export function formatDisplayPath(
  path: string,
  options: DisplayPathOptions = {},
): string {
  if (options.homeRelative) {
    return formatHomeRelativePath(path);
  }

  if (options.alwaysQuote || shouldQuotePath(path)) {
    return quotePath(path);
  }

  return path;
}

export function decodeSeparatorValue(value: string): string {
  return value.replace(/\\([ntr\\])/g, (_, escape: string) => {
    switch (escape) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      case "\\":
        return "\\";
      default:
        return `\\${escape}`;
    }
  });
}

export function buildContentBlocks(
  entries: { fileContent: string; resolvedPath: string }[],
  pathMode: ContentPathMode,
  cwd: string = process.cwd(),
): string {
  return entries
    .map(({ resolvedPath, fileContent }) => {
      if (pathMode === "none") {
        return fileContent;
      }
      let displayPath: string;
      if (pathMode === "only-name") {
        displayPath = basename(resolvedPath);
      } else if (pathMode === "relative") {
        displayPath = relative(cwd, resolvedPath);
      } else {
        displayPath = resolvedPath;
      }
      return `${displayPath}\n\n${fileContent}`;
    })
    .join("\n\n");
}

export function parseArgs(args: string[]): ParsedArgs {
  let separator = " ";
  let useBasename = false;
  let useQuotes = false;
  let copyContent = false;
  let randomCount: number | null = null;
  let recursive = false;
  let homeRelative = false;
  let contentPathMode: ContentPathMode = "none";
  let dryRun = false;
  let gitUntracked = false;
  const selectors: Selector[] = [];
  const files: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "-c":
        throw new Error('Flag -c was removed. Use --separator "," instead.');
      case "-t":
        throw new Error('Flag -t was removed. Use --separator "\\t" instead.');
      case "-l":
        throw new Error('Flag -l was removed. Use --separator "\\n" instead.');
      case "-s":
        throw new Error("Flag -s was removed. Use --separator instead.");
      case "--separator": {
        const value = args[index + 1];
        if (value === undefined) {
          throw new Error(
            'Usage: --separator requires a value (e.g., --separator "\\n")',
          );
        }

        const decoded = decodeSeparatorValue(value);
        if (decoded.length === 0) {
          throw new Error("--separator value cannot be empty");
        }

        separator = decoded;
        index += 1;
        continue;
      }
      case "-b":
        throw new Error("Flag -b was removed. Use --name-only instead.");
      case "--name-only":
        useBasename = true;
        continue;
      case "-q":
        throw new Error("Flag -q was removed. Use --quote instead.");
      case "--quote":
        useQuotes = true;
        continue;
      case "-C":
        throw new Error("Flag -C was removed. Use --content instead.");
      case "--content":
        copyContent = true;
        continue;
      case "--content-path-mode": {
        const value = args[index + 1];
        if (value === undefined) {
          throw new Error(
            "Usage: --content-path-mode requires a value (only-name, fullpath, relative)",
          );
        }

        if (
          value !== "only-name" &&
          value !== "fullpath" &&
          value !== "relative" &&
          value !== "none"
        ) {
          throw new Error(
            `Invalid value for --content-path-mode: ${value}. Valid values: only-name, fullpath, relative, none`,
          );
        }

        contentPathMode = value;
        index += 1;
        continue;
      }
      case "--dry-run":
        dryRun = true;
        continue;
      case "--git-untracked":
        gitUntracked = true;
        continue;
      case "-R":
        throw new Error("Flag -R was removed. Use --recursive instead.");
      case "--recursive":
        recursive = true;
        continue;
      case "-H":
        throw new Error("Flag -H was removed. Use --home-relative instead.");
      case "--home-relative":
        homeRelative = true;
        continue;
      case "--all":
        selectors.push("all");
        continue;
      case "--subtitles":
        throw new Error(
          "Flag --subtitles was removed. Use --type subtitles instead.",
        );
      case "--images":
        throw new Error(
          "Flag --images was removed. Use --type images instead.",
        );
      case "--text":
        throw new Error("Flag --text was removed. Use --type text instead.");
      case "--type": {
        const value = args[index + 1];
        if (value === undefined) {
          throw new Error(
            "Usage: --type requires a value (images, subtitles, or text)",
          );
        }

        if (!Object.hasOwn(fileGroups, value)) {
          throw new Error(
            `Invalid value for --type: ${value}. Valid groups: ${TYPE_GROUPS.join(", ")}`,
          );
        }

        selectors.push(value as FileGroupName);
        index += 1;
        continue;
      }
      case "-r":
        throw new Error("Flag -r was removed. Use --random instead.");
      case "--random": {
        const countStr = args[index + 1];
        if (countStr === undefined) {
          throw new Error(
            "Usage: --random requires a number argument (e.g., --random 3)",
          );
        }

        const parsed = parseInt(countStr, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new Error(`Invalid number for --random flag: ${countStr}`);
        }

        randomCount = parsed;
        index += 1;
        continue;
      }
      default:
        files.push(arg);
    }
  }

  return {
    copyContent,
    contentPathMode,
    dryRun,
    files,
    gitUntracked,
    homeRelative,
    randomCount,
    recursive,
    selectors,
    separator,
    useBasename,
    useQuotes,
  };
}

export function validateParsedArgs(args: ParsedArgs): void {
  if (!args.homeRelative) {
    return;
  }

  if (args.copyContent || args.useBasename || args.useQuotes) {
    throw new Error(
      "--home-relative cannot be combined with --content, --name-only, or --quote",
    );
  }
}

export function mergeUniquePaths(...pathSets: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const pathSet of pathSets) {
    for (const file of pathSet) {
      if (seen.has(file)) {
        continue;
      }

      seen.add(file);
      merged.push(file);
    }
  }

  return merged;
}

export function applyRandomSelection(
  files: string[],
  randomCount: number | null,
  randomizer: <T>(items: T[]) => T[] = shuffleArray,
): string[] {
  if (randomCount === null) {
    return files;
  }

  return randomizer(files).slice(0, randomCount);
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function collectGitUntrackedFiles(): Promise<string[]> {
  const child = spawn("git", ["ls-files", "--others", "--exclude-standard"], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
  const exitCode = await new Promise<number>((r) => child.on("close", r));

  if (exitCode !== 0) {
    return [];
  }

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function readFilesFromStdin(): Promise<string[]> {
  await new Promise((resolve) => setTimeout(resolve, 0));

  if (process.stdin.isTTY) {
    return [];
  }

  const stdinText = await readStdin();
  return stdinText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function collectSelectorFiles(
  selectors: Selector[],
  recursive: boolean,
): Promise<string[]> {
  if (selectors.length === 0) {
    return [];
  }

  const fdArgs = ["fd", "--type", "file"];

  if (!recursive) {
    fdArgs.push("--max-depth", "1");
  }

  const extensions = new Set<string>();

  for (const selector of selectors) {
    if (selector === "all") {
      const child = spawn(fdArgs[0], fdArgs.slice(1), {
        stdio: ["ignore", "pipe", "inherit"],
      });

      let stdout = "";
      child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
      const code = await new Promise<number>((r) => child.on("close", r));

      if (code !== 0) {
        process.exit(code);
      }

      return stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }

    for (const extension of fileGroups[selector].extensions) {
      extensions.add(extension);
    }
  }

  const child = spawn(
    fdArgs[0],
    [
      ...fdArgs.slice(1),
      ...Array.from(extensions).flatMap((extension) => [
        "--extension",
        extension,
      ]),
    ],
    {
      stdio: ["ignore", "pipe", "inherit"],
    },
  );

  let stdout = "";
  child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
  const code = await new Promise<number>((r) => child.on("close", r));

  if (code !== 0) {
    process.exit(code);
  }

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function printUsage(): void {
  const selectorHelp = fileGroupNames
    .map(
      (name) =>
        `  --type ${name.padEnd(7)} copy ${fileGroups[name].description.toLowerCase()}`,
    )
    .join("\n");

  console.error(
    "Usage: tsx copy-files.ts [--separator <value>] [--content] [--home-relative] [--name-only] [--quote] [--all | --type <group> ...] [--recursive] [--random <n>] [--git-untracked] <file1> [file2] ...",
  );
  console.error(
    "       fd ... | tsx copy-files.ts [--separator <value>] [--random <n>]",
  );
  console.error(
    "  --separator     custom separator for full paths; supports \\n, \\t, \\r, \\\\",
  );
  console.error(
    "  --content       copy content with a full path header for each file",
  );
  console.error(
    "  --content-path-mode path format for --content: only-name, fullpath, relative",
  );
  console.error(
    "  --dry-run       show content that would be copied without actually copying",
  );
  console.error(
    "  --git-untracked include untracked files from git repository",
  );
  console.error("  --home-relative render paths under $HOME as ~/...");
  console.error(
    "  --name-only     copy basename only (filename/directory name only)",
  );
  console.error("  --quote         always wrap paths in double quotes");
  console.error("  --recursive     search subdirectories for selector flags");
  console.error(
    "  --all           copy all files in the current directory scope",
  );
  console.error(selectorHelp);
  console.error("  --random <n>    randomly select n files to copy");
  console.error('  Examples: --separator "\\n", --separator "\\t"');
  console.error("  (default: full paths separated by spaces)");
}

async function main() {
  let parsedArgs: ParsedArgs;

  try {
    parsedArgs = parseArgs(process.argv.slice(2));
    validateParsedArgs(parsedArgs);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  let files = parsedArgs.files;

  const selectorFiles = await collectSelectorFiles(
    parsedArgs.selectors,
    parsedArgs.recursive,
  );

  if (files.length === 0 && selectorFiles.length === 0) {
    files = await readFilesFromStdin();
  }

  files = mergeUniquePaths(files, selectorFiles);

  if (parsedArgs.gitUntracked) {
    const gitFiles = await collectGitUntrackedFiles();
    files = mergeUniquePaths(files, gitFiles);
  }

  if (files.length === 0) {
    printUsage();
    process.exit(1);
  }

  files = applyRandomSelection(files, parsedArgs.randomCount);

  const existingFiles: string[] = [];
  const contentEntries: { fileContent: string; resolvedPath: string }[] = [];
  if (!parsedArgs.dryRun) {
    for (const file of files) {
      if (!existsSync(file)) {
        console.error(`✗ Not found: ${file}`);
        continue;
      }

      const fullPath = realpathSync(file);

      if (parsedArgs.copyContent) {
        try {
          const content = readFileSync(fullPath, "utf-8");
          contentEntries.push({ fileContent: content, resolvedPath: fullPath });
          console.log(`✓ Read content: ${file}`);
        } catch {
          console.error(`✗ Failed to read: ${file}`);
        }

        continue;
      }

      const pathToRender = parsedArgs.useBasename
        ? basename(fullPath)
        : fullPath;
      const displayPath = formatDisplayPath(pathToRender, {
        alwaysQuote: parsedArgs.useQuotes,
        homeRelative: parsedArgs.homeRelative,
      });

      existingFiles.push(displayPath);
      console.log(`✓ Found: ${displayPath}`);
    }
  }

  if (parsedArgs.copyContent) {
    if (contentEntries.length === 0) {
      console.error("No valid files read to copy content");
      process.exit(1);
    }

    const clipboardContent = buildContentBlocks(
      contentEntries,
      parsedArgs.contentPathMode,
    );

    const child = spawn("wl-copy", [], { stdio: ["pipe", "inherit", "inherit"] });
    child.stdin.write(clipboardContent);
    child.stdin.end();
    const exitCode = await new Promise<number>((r) => child.on("close", r));

    if (exitCode === 0) {
      console.log(
        `\nCopied content of ${contentEntries.length} file(s) to clipboard`,
      );
      return;
    }

    console.error("Failed to copy to clipboard");
    process.exit(1);
  }

  if (existingFiles.length === 0) {
    console.error("No existing files to copy to clipboard");
    process.exit(1);
  }

  const clipboardContent = existingFiles.join(parsedArgs.separator);

  if (parsedArgs.dryRun) {
    console.log(clipboardContent);
    return;
  }

  const child = spawn("wl-copy", [], { stdio: ["pipe", "inherit", "inherit"] });
  child.stdin.write(clipboardContent);
  child.stdin.end();
  const exitCode = await new Promise<number>((r) => child.on("close", r));

  if (exitCode === 0) {
    console.log(`\nCopied ${existingFiles.length} path(s) to clipboard`);
    return;
  }

  console.error("Failed to copy to clipboard");
  process.exit(1);
}

if (isMain(import.meta.url)) {
  main().catch((err: unknown) => { console.error(err); process.exit(1); });
}
