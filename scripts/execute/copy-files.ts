import { existsSync, realpathSync } from "fs";

// Parse arguments
const args = process.argv.slice(2);

// Determine separator based on flags
let separator = " ";

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

// Remaining args are files
const files = args;

if (files.length === 0) {
  console.error("Usage: bun run copy-files.ts [-c|-t|-l] <file1> [file2] ...");
  console.error("  -c  comma separated");
  console.error("  -t  tab separated");
  console.error("  -l  line separated (one per line)");
  console.error("  (default: space separated)");
  process.exit(1);
}

const existingFiles: string[] = [];

for (const file of files) {
  if (existsSync(file)) {
    // Get full absolute path
    const fullPath = realpathSync(file);
    existingFiles.push(fullPath);
    console.log(`✓ Found: ${fullPath}`);
  } else {
    console.error(`✗ Not found: ${file}`);
  }
}

if (existingFiles.length === 0) {
  console.error("No existing files to copy to clipboard");
  process.exit(1);
}

// Join paths with selected separator
const clipboardContent = existingFiles.join(separator);

// Copy to clipboard using wl-copy
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
