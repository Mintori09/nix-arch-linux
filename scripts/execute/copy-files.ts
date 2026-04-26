import { existsSync, realpathSync, readFileSync } from "fs";
import { basename } from "path";

const SHELL_UNSAFE_PATH_PATTERN = /[\s"'`$!&;|<>(){}\[\]*?~#]/;

export function shouldQuotePath(path: string): boolean {
  return SHELL_UNSAFE_PATH_PATTERN.test(path);
}

export function quotePath(path: string): string {
  const escapedPath = path.replace(/["\\$`!]/g, "\\$&");
  return `"${escapedPath}"`;
}

export function formatDisplayPath(
  path: string,
  options: { alwaysQuote?: boolean } = {},
): string {
  if (options.alwaysQuote || shouldQuotePath(path)) {
    return quotePath(path);
  }

  return path;
}

// Helper function to shuffle array (Fisher-Yates shuffle)
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);

  // Determine separator based on flags
  let separator = " ";
  let useBasename = false;
  let useQuotes = false;
  let copyContent = false;
  let randomCount: number | null = null;

  const commaIndex = args.indexOf("-c");
  if (commaIndex !== -1) {
    separator = ",";
    args.splice(commaIndex, 1);
  }

  const tabIndex = args.indexOf("-t");
  if (tabIndex !== -1) {
    separator = "\t";
    args.splice(tabIndex, 1);
  }

  const lineIndex = args.indexOf("-l");
  if (lineIndex !== -1) {
    separator = "\n";
    args.splice(lineIndex, 1);
  }

  const basenameIndex = args.indexOf("-b");
  if (basenameIndex !== -1) {
    useBasename = true;
    args.splice(basenameIndex, 1);
  }

  const quoteIndex = args.indexOf("-q");
  if (quoteIndex !== -1) {
    useQuotes = true;
    args.splice(quoteIndex, 1);
  }

  const contentIndex = args.indexOf("-C");
  if (contentIndex !== -1) {
    copyContent = true;
    args.splice(contentIndex, 1);
  }

  const randomIndex = args.indexOf("-r");
  if (randomIndex !== -1) {
    if (args.length > randomIndex + 1) {
      const countStr = args[randomIndex + 1];
      const parsed = parseInt(countStr, 10);
      if (!isNaN(parsed) && parsed > 0) {
        randomCount = parsed;
        args.splice(randomIndex, 2);
      } else {
        console.error(`Invalid number for -r flag: ${countStr}`);
        process.exit(1);
      }
    } else {
      console.error("Usage: -r requires a number argument (e.g., -r 3)");
      process.exit(1);
    }
  }

  let files = args;

  if (files.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 0));

    if (!process.stdin.isTTY) {
      const stdinText = await Bun.stdin.text();
      files = stdinText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    }
  }

  if (files.length === 0) {
    console.error(
      "Usage: bun run copy-files.ts [-c|-t|-l|-b|-q|-C|-r <n>] <file1> [file2] ...",
    );
    console.error(
      "       fd ... | bun run copy-files.ts [-c|-t|-l|-b|-q|-C|-r <n>]",
    );
    console.error("  -c  comma separated");
    console.error("  -t  tab separated");
    console.error("  -l  line separated (one per line)");
    console.error("  -b  copy basename only (filename/directory name only)");
    console.error("  -q  always wrap paths in double quotes");
    console.error("  -C  copy file content instead of path");
    console.error("  -r <n>  randomly select n files to copy");
    console.error("  (default: space separated, full path)");
    process.exit(1);
  }

  if (randomCount !== null) {
    files = shuffleArray(files).slice(0, randomCount);
  }

  const existingFiles: string[] = [];
  const fileContents: string[] = [];

  for (const file of files) {
    if (existsSync(file)) {
      const fullPath = realpathSync(file);

      if (copyContent) {
        try {
          const content = readFileSync(fullPath, "utf-8");
          fileContents.push(content);
          console.log(`✓ Read content: ${file}`);
        } catch {
          console.error(`✗ Failed to read: ${file}`);
        }
      } else {
        const pathToRender = useBasename ? basename(fullPath) : fullPath;
        const displayPath = formatDisplayPath(pathToRender, {
          alwaysQuote: useQuotes,
        });

        existingFiles.push(displayPath);
        console.log(`✓ Found: ${displayPath}`);
      }
    } else {
      console.error(`✗ Not found: ${file}`);
    }
  }

  if (copyContent) {
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
    } else {
      console.error("Failed to copy to clipboard");
      process.exit(1);
    }
  } else {
    if (existingFiles.length === 0) {
      console.error("No existing files to copy to clipboard");
      process.exit(1);
    }

    const clipboardContent = existingFiles.join(separator);
    const proc = Bun.spawn(["wl-copy"], {
      stdin: new Response(clipboardContent),
    });

    await proc.exited;

    if (proc.exitCode === 0) {
      console.log(`\nCopied ${existingFiles.length} path(s) to clipboard`);
    } else {
      console.error("Failed to copy to clipboard");
      process.exit(1);
    }
  }
}

if (import.meta.main) {
  await main();
}
