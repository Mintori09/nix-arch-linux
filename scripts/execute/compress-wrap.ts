// compress-wrap.ts
// Simple, safe compression wrapper for Bun using the output filename extension.

import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  realpathSync,
  renameSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";

type CompressionType =
  | "zip"
  | "tar"
  | "tar.gz"
  | "tar.bz2"
  | "tar.xz"
  | "7z"
  | "gz"
  | "bz2"
  | "xz";

const PROGRAM_NAME = path.basename(process.argv[1] ?? "compress-wrap.ts");

function usage(): void {
  console.log(`Usage:
  bun ${PROGRAM_NAME} [-f|--force] OUTPUT INPUT...

Examples:
  bun ${PROGRAM_NAME} project.zip src README.md
  bun ${PROGRAM_NAME} logs.tar.gz logs/
  bun ${PROGRAM_NAME} backup.7z Documents/
  bun ${PROGRAM_NAME} file.txt.gz file.txt
  bun ${PROGRAM_NAME} -f project.zip src/

Supported output extensions:
  .zip
  .tar
  .tar.gz, .tgz
  .tar.bz2, .tbz2
  .tar.xz, .txz
  .7z
  .gz
  .bz2
  .xz

Notes:
  .gz, .bz2, and .xz compress exactly one regular file.
  For multiple files or directories, use .zip, .tar.*, or .7z.

Options:
  -f, --force   overwrite output file if it already exists
  -h, --help    show this help`);
}

function die(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findCommand(command: string): string | null {
  if (command.includes(path.sep)) {
    return isExecutable(command) ? command : null;
  }

  const pathDirs = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean);

  for (const dir of pathDirs) {
    const candidate = path.join(dir, command);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}

function needCommand(command: string): string {
  const found = findCommand(command);
  if (!found) {
    die(`required command not found: ${command}`);
  }
  return found;
}

function find7z(): string {
  return (
    findCommand("7z") ??
    findCommand("7za") ??
    die("required command not found: 7z or 7za")
  );
}

function detectType(output: string): CompressionType {
  if (output.endsWith(".tar.gz") || output.endsWith(".tgz")) return "tar.gz";
  if (output.endsWith(".tar.bz2") || output.endsWith(".tbz2")) return "tar.bz2";
  if (output.endsWith(".tar.xz") || output.endsWith(".txz")) return "tar.xz";
  if (output.endsWith(".zip")) return "zip";
  if (output.endsWith(".tar")) return "tar";
  if (output.endsWith(".7z")) return "7z";
  if (output.endsWith(".gz")) return "gz";
  if (output.endsWith(".bz2")) return "bz2";
  if (output.endsWith(".xz")) return "xz";

  die(`cannot detect compression type from output extension: ${output}`);
}

function tempExtension(type: CompressionType): string {
  switch (type) {
    case "zip":
      return ".zip";
    case "tar":
      return ".tar";
    case "tar.gz":
      return ".tar.gz";
    case "tar.bz2":
      return ".tar.bz2";
    case "tar.xz":
      return ".tar.xz";
    case "7z":
      return ".7z";
    case "gz":
      return ".gz";
    case "bz2":
      return ".bz2";
    case "xz":
      return ".xz";
  }
}

function checkOutputPath(output: string, force: boolean): void {
  if (!output) {
    die("output file is empty");
  }

  const outputDir = path.dirname(output);

  if (!existsSync(outputDir)) {
    die(`output directory does not exist: ${outputDir}`);
  }

  const outputDirStats = lstatSync(outputDir);
  if (!outputDirStats.isDirectory()) {
    die(`output parent is not a directory: ${outputDir}`);
  }

  try {
    accessSync(outputDir, constants.W_OK);
  } catch {
    die(`output directory is not writable: ${outputDir}`);
  }

  if (existsSync(output) && !force) {
    die(`output already exists: ${output} (use -f to overwrite)`);
  }

  if (path.basename(output).startsWith("-")) {
    die(`output names starting with '-' are not supported safely: ${output}`);
  }

  if (existsSync(output) && lstatSync(output).isDirectory()) {
    die(`output path is a directory: ${output}`);
  }
}

function checkInputsExist(inputs: string[]): void {
  if (inputs.length === 0) {
    die("missing input files or directories");
  }

  for (const input of inputs) {
    if (!existsSync(input)) {
      die(`input does not exist: ${input}`);
    }

    if (input === ".") {
      die(
        "refusing to compress current directory directly; use a named directory instead",
      );
    }

    if (input === "..") {
      die(
        "refusing to compress parent directory directly; use a named directory instead",
      );
    }

    if (path.basename(input).startsWith("-")) {
      die(`input names starting with '-' are not supported safely: ${input}`);
    }
  }
}

function resolvedPath(filePath: string): string {
  return existsSync(filePath) ? realpathSync(filePath) : path.resolve(filePath);
}

function checkOutputNotInInputs(output: string, inputs: string[]): void {
  const outputAbs = resolvedPath(output);

  for (const input of inputs) {
    const inputAbs = resolvedPath(input);

    if (outputAbs === inputAbs) {
      die(`output file cannot also be an input: ${input}`);
    }

    if (lstatSync(input).isDirectory()) {
      const relative = path.relative(inputAbs, outputAbs);
      const outputInsideInput =
        relative !== "" &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative);

      if (outputInsideInput) {
        die(`output file cannot be created inside input directory: ${input}`);
      }
    }
  }
}

function checkSingleRegularFile(inputs: string[]): void {
  if (inputs.length !== 1) {
    die("this format accepts exactly one input file");
  }

  if (!lstatSync(inputs[0]!).isFile()) {
    die(`this format accepts one regular file, not a directory: ${inputs[0]}`);
  }
}

function checkDependencies(type: CompressionType): void {
  switch (type) {
    case "zip":
      needCommand("zip");
      return;
    case "tar":
    case "tar.gz":
    case "tar.bz2":
    case "tar.xz":
      needCommand("tar");
      return;
    case "7z":
      find7z();
      return;
    case "gz":
      needCommand("gzip");
      return;
    case "bz2":
      needCommand("bzip2");
      return;
    case "xz":
      needCommand("xz");
      return;
  }
}

function makeTempOutput(output: string, type: CompressionType): string {
  const outputDir = path.dirname(output);
  const outputName = path.basename(output);
  const randomPart = Math.random().toString(16).slice(2);
  return path.join(
    outputDir,
    `.${outputName}.tmp-${process.pid}-${randomPart}${tempExtension(type)}`,
  );
}

function removeFileIfExists(filePath: string): void {
  if (existsSync(filePath)) {
    rmSync(filePath, { force: true });
  }
}

function runCommand(command: string[]): boolean {
  const result = Bun.spawnSync({
    cmd: command,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  return result.exitCode === 0;
}

function compressArchive(
  type: CompressionType,
  output: string,
  inputs: string[],
): boolean {
  switch (type) {
    case "zip":
      return runCommand(["zip", "-r", output, ...inputs]);
    case "tar":
      return runCommand(["tar", "-cf", output, "--", ...inputs]);
    case "tar.gz":
      return runCommand(["tar", "-czf", output, "--", ...inputs]);
    case "tar.bz2":
      return runCommand(["tar", "-cjf", output, "--", ...inputs]);
    case "tar.xz":
      return runCommand(["tar", "-cJf", output, "--", ...inputs]);
    case "7z":
      return runCommand([find7z(), "a", "--", output, ...inputs]);
    default:
      die(`internal error: unsupported archive type: ${type}`);
  }
}

function compressSingleFileWithRedirect(
  type: CompressionType,
  output: string,
  input: string,
): boolean {
  const command =
    type === "gz"
      ? `gzip -c -- "$1" > "$2"`
      : type === "bz2"
        ? `bzip2 -c -- "$1" > "$2"`
        : `xz -c -- "$1" > "$2"`;

  const result = Bun.spawnSync({
    cmd: ["sh", "-c", command, "compress-wrap", input, output],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  return result.exitCode === 0;
}

function parseArgs(args: string[]): {
  force: boolean;
  output: string;
  inputs: string[];
} {
  let force = false;
  let index = 0;

  while (index < args.length) {
    const arg = args[index]!;

    if (arg === "-f" || arg === "--force") {
      force = true;
      index += 1;
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    }

    if (arg === "--") {
      index += 1;
      break;
    }

    if (arg.startsWith("-")) {
      die(`unknown option: ${arg}`);
    }

    break;
  }

  const rest = args.slice(index);

  if (rest.length < 2) {
    usage();
    process.exit(1);
  }

  return {
    force,
    output: rest[0]!,
    inputs: rest.slice(1),
  };
}

function main(): void {
  const { force, output, inputs } = parseArgs(process.argv.slice(2));
  const type = detectType(output);

  checkDependencies(type);
  checkInputsExist(inputs);
  checkOutputPath(output, force);
  checkOutputNotInInputs(output, inputs);

  if (type === "gz" || type === "bz2" || type === "xz") {
    checkSingleRegularFile(inputs);
  }

  const tempOutput = makeTempOutput(output, type);
  removeFileIfExists(tempOutput);

  const ok =
    type === "zip" ||
    type === "tar" ||
    type === "tar.gz" ||
    type === "tar.bz2" ||
    type === "tar.xz" ||
    type === "7z"
      ? compressArchive(type, tempOutput, inputs)
      : compressSingleFileWithRedirect(type, tempOutput, inputs[0]!);

  if (!ok) {
    removeFileIfExists(tempOutput);
    die("compression failed; partial output removed");
  }

  try {
    renameSync(tempOutput, output);
  } catch (error) {
    removeFileIfExists(tempOutput);
    const message = error instanceof Error ? error.message : String(error);
    die(`could not move compressed file into place: ${message}`);
  }

  console.log(`Created: ${output}`);
}

main();
