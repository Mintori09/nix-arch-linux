import { existsSync, readFileSync, realpathSync } from "fs";
import { basename, relative } from "path";
import { homedir } from "os";

import { fileGroupNames, fileGroups } from "./file-groups";

const SHELL_UNSAFE_PATH_PATTERN = /[\s"'`$!&;|<>(){}\[\]*?~#]/;
const HOME_DIR = homedir();

const SELECTOR_FLAG_TO_GROUP = {
  "--subtitles": "subtitles",
  "--images": "images",
  "--text": "text",
} as const;

type Separator = " " | "," | "\t" | "\n";
type FileGroupName = keyof typeof fileGroups;
type Selector = "all" | FileGroupName;

type ParsedArgs = {
  copyContent: boolean;
  files: string[];
  homeRelative: boolean;
  randomCount: number | null;
  recursive: boolean;
  selectors: Selector[];
  separator: Separator;
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

  return relPath === ""
    ? "~"
    : `~/${escapeShellPath(relPath)}`;
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

export function parseArgs(args: string[]): ParsedArgs {
  let separator: Separator = " ";
  let useBasename = false;
  let useQuotes = false;
  let copyContent = false;
  let randomCount: number | null = null;
  let recursive = false;
  let homeRelative = false;
  const selectors: Selector[] = [];
  const files: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "-c":
        separator = ",";
        continue;
      case "-t":
        separator = "\t";
        continue;
      case "-l":
        separator = "\n";
        continue;
      case "-b":
        useBasename = true;
        continue;
      case "-q":
        useQuotes = true;
        continue;
      case "-C":
        copyContent = true;
        continue;
      case "-R":
      case "--recursive":
        recursive = true;
        continue;
      case "-H":
      case "--home-relative":
        homeRelative = true;
        continue;
      case "--all":
        selectors.push("all");
        continue;
      case "--subtitles":
      case "--images":
      case "--text":
        selectors.push(SELECTOR_FLAG_TO_GROUP[arg]);
        continue;
      case "-r": {
        const countStr = args[index + 1];
        if (countStr === undefined) {
          throw new Error("Usage: -r requires a number argument (e.g., -r 3)");
        }

        const parsed = parseInt(countStr, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new Error(`Invalid number for -r flag: ${countStr}`);
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
    files,
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
      "--home-relative cannot be combined with -C, -b, or -q",
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

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function readFilesFromStdin(): Promise<string[]> {
  await new Promise((resolve) => setTimeout(resolve, 0));

  if (process.stdin.isTTY) {
    return [];
  }

  const stdinText = await Bun.stdin.text();
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
      const proc = Bun.spawn(fdArgs, {
        stdout: "pipe",
        stderr: "inherit",
      });

      const output = await new Response(proc.stdout).text();
      const code = await proc.exited;

      if (code !== 0) {
        process.exit(code);
      }

      return output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }

    for (const extension of fileGroups[selector].extensions) {
      extensions.add(extension);
    }
  }

  const proc = Bun.spawn(
    [
      ...fdArgs,
      ...Array.from(extensions).flatMap((extension) => [
        "--extension",
        extension,
      ]),
    ],
    {
      stdout: "pipe",
      stderr: "inherit",
    },
  );

  const output = await new Response(proc.stdout).text();
  const code = await proc.exited;

  if (code !== 0) {
    process.exit(code);
  }

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function printUsage(): void {
  const selectorHelp = fileGroupNames
    .map((name) => `  --${name.padEnd(11)} copy ${fileGroups[name].description.toLowerCase()}`)
    .join("\n");

  console.error(
    "Usage: bun run copy-files.ts [-c|-t|-l|-b|-q|-C|-H] [--all|--subtitles|--images|--text] [-R] [-r <n>] <file1> [file2] ...",
  );
  console.error(
    "       fd ... | bun run copy-files.ts [-c|-t|-l|-b|-q|-C|-H] [-r <n>]",
  );
  console.error("  -c  comma separated");
  console.error("  -t  tab separated");
  console.error("  -l  line separated (one per line)");
  console.error("  -b  copy basename only (filename/directory name only)");
  console.error("  -q  always wrap paths in double quotes");
  console.error("  -C  copy file content instead of path");
  console.error("  -H, --home-relative  render paths under $HOME as ~/...");
  console.error("  -R, --recursive  search subdirectories for selector flags");
  console.error("  --all        copy all files in the current directory scope");
  console.error(selectorHelp);
  console.error("  -r <n>  randomly select n files to copy");
  console.error("  (default: space separated, full path)");
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

  if (files.length === 0) {
    printUsage();
    process.exit(1);
  }

  files = applyRandomSelection(files, parsedArgs.randomCount);

  const existingFiles: string[] = [];
  const fileContents: string[] = [];

  for (const file of files) {
    if (!existsSync(file)) {
      console.error(`✗ Not found: ${file}`);
      continue;
    }

    const fullPath = realpathSync(file);

    if (parsedArgs.copyContent) {
      try {
        const content = readFileSync(fullPath, "utf-8");
        fileContents.push(content);
        console.log(`✓ Read content: ${file}`);
      } catch {
        console.error(`✗ Failed to read: ${file}`);
      }

      continue;
    }

    const pathToRender = parsedArgs.useBasename ? basename(fullPath) : fullPath;
    const displayPath = formatDisplayPath(pathToRender, {
      alwaysQuote: parsedArgs.useQuotes,
      homeRelative: parsedArgs.homeRelative,
    });

    existingFiles.push(displayPath);
    console.log(`✓ Found: ${displayPath}`);
  }

  if (parsedArgs.copyContent) {
    if (fileContents.length === 0) {
      console.error("No valid files read to copy content");
      process.exit(1);
    }

    const clipboardContent = fileContents.join("\n");
    const proc = Bun.spawn(["wl-copy"], {
      stdin: new Response(clipboardContent),
    });

    await proc.exited;

    if (proc.exitCode === 0) {
      console.log(
        `\nCopied content of ${fileContents.length} file(s) to clipboard`,
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
  const proc = Bun.spawn(["wl-copy"], {
    stdin: new Response(clipboardContent),
  });

  await proc.exited;

  if (proc.exitCode === 0) {
    console.log(`\nCopied ${existingFiles.length} path(s) to clipboard`);
    return;
  }

  console.error("Failed to copy to clipboard");
  process.exit(1);
}

if (import.meta.main) {
  await main();
}
