#!/usr/bin/env bun

import path from "node:path";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";

const COLORS = {
  BLUE: "\x1b[34m",
  GREEN: "\x1b[32m",
  RED: "\x1b[31m",
  YELLOW: "\x1b[33m",
  NC: "\x1b[0m",
} as const;

const REQUIRED_TOOLS = ["rpm2cpio", "cpio"] as const;
const INSTALL_ONLY_TOOLS = ["sudo"] as const;

type ToolName = (typeof REQUIRED_TOOLS)[number] | (typeof INSTALL_ONLY_TOOLS)[number];

type CommandOptions = {
  captureStdout?: boolean;
  stdin?: ReadableStream | Blob | BufferSource | string;
};

type ParsedCli = {
  force: boolean;
  help: boolean;
  install: boolean;
  positionals: string[];
};

type CommandSpec = {
  argv: string[];
  cwd?: string;
};

type Workspace = {
  cleanupAfterUse: boolean;
  targetDir: string;
};

type InstallOptions = {
  force: boolean;
  install: boolean;
  rpmPath: string;
  targetDir?: string;
};

type RunContext = {
  absoluteRpmPath: string;
  install: boolean;
  targetDir: string;
  workspaceCleanupAfterUse: boolean;
};

class CliError extends Error {
  exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

class CommandExecutionError extends Error {
  command: string;
  exitCode: number;
  stderr: string;

  constructor(command: string, exitCode: number, stderr: string) {
    super(`Command failed with exit code ${exitCode}`);
    this.name = "CommandExecutionError";
    this.command = command;
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export function printUsage(): void {
  console.log(`irpm - extract files from an RPM and optionally install them

Usage:
  irpm [--install|-i] [--force|-f] <path-to-rpm> [destination-folder]

Behavior:
  irpm package.rpm
    Extracts to ./extracted_rpm

  irpm package.rpm ./dir
    Extracts to ./dir

  irpm --install package.rpm
    Extracts to a temporary directory, asks for confirmation, then installs to /

Options:
  -i, --install  enable deployment to / after extraction
  -f, --force    replace an existing extraction directory
  -h, --help     show this help message
`);
}

function shellEscape(value: string): string {
  if (/^[a-zA-Z0-9_./:@=+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function formatCommand(parts: readonly string[]): string {
  return parts.map(shellEscape).join(" ");
}

function shortStderr(stderr: string, maxLines = 8, maxChars = 700): string {
  const trimmed = stderr.trim();
  if (!trimmed) return "(empty stderr)";

  const lines = trimmed.split("\n").slice(0, maxLines).join("\n");
  return lines.length <= maxChars ? lines : `${lines.slice(0, maxChars)}...`;
}

export function parseCliArgs(argv: string[]): ParsedCli {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      force: { type: "boolean", short: "f", default: false },
      help: { type: "boolean", short: "h", default: false },
      install: { type: "boolean", short: "i", default: false },
    },
    strict: true,
  });

  return {
    force: parsed.values.force === true,
    help: parsed.values.help === true,
    install: parsed.values.install === true,
    positionals: parsed.positionals,
  };
}

function resolvePath(inputPath: string): string {
  return path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(process.cwd(), inputPath);
}

export function ensureRequiredTools(
  install: boolean,
  toolResolver: (tool: string) => string | null = Bun.which,
): void {
  const missing = REQUIRED_TOOLS.filter((tool) => !toolResolver(tool));
  const installMissing = install
    ? INSTALL_ONLY_TOOLS.filter((tool) => !toolResolver(tool))
    : [];
  const allMissing = [...missing, ...installMissing];

  if (allMissing.length > 0) {
    throw new CliError(
      `${COLORS.RED}Missing dependencies:${COLORS.NC} ${allMissing.join(", ")}`,
    );
  }
}

async function runCommand(
  parts: readonly string[],
  options: CommandOptions = {},
): Promise<string> {
  const command = formatCommand(parts);
  const proc = Bun.spawn(parts, {
    cwd: process.cwd(),
    stderr: "pipe",
    stdin: options.stdin ?? "ignore",
    stdout: options.captureStdout ? "pipe" : "inherit",
  });

  const stderrPromise = new Response(proc.stderr).text();
  const stdoutPromise = options.captureStdout
    ? new Response(proc.stdout).text()
    : Promise.resolve("");

  const [exitCode, stderr, stdout] = await Promise.all([
    proc.exited,
    stderrPromise,
    stdoutPromise,
  ]);

  if (exitCode !== 0) {
    throw new CommandExecutionError(command, exitCode, shortStderr(stderr));
  }

  return stdout;
}

export function normalizeArchiveEntry(entry: string): string {
  const withoutLeadingDots = entry.replace(/^\.\/+/, "");
  return path.posix.normalize(withoutLeadingDots);
}

export function findUnsafeArchiveEntries(entries: readonly string[]): string[] {
  return entries.filter((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) return false;

    if (path.posix.isAbsolute(trimmed)) {
      return true;
    }

    const normalized = normalizeArchiveEntry(trimmed);
    return normalized === ".." || normalized.startsWith("../");
  });
}

export function buildExtractCommands(
  rpmPath: string,
  targetDir: string,
): { cpio: CommandSpec; rpm2cpio: CommandSpec } {
  return {
    rpm2cpio: {
      argv: ["rpm2cpio", rpmPath],
    },
    cpio: {
      argv: [
        "cpio",
        "--extract",
        "--make-directories",
        "--preserve-modification-time",
        "--unconditional",
        "--directory",
        targetDir,
        "--no-absolute-filenames",
        "--verbose",
      ],
    },
  };
}

async function listArchiveEntries(rpmPath: string): Promise<string[]> {
  const rpmProc = Bun.spawn(["rpm2cpio", rpmPath], {
    cwd: process.cwd(),
    stderr: "pipe",
    stdout: "pipe",
  });

  const cpioProc = Bun.spawn(["cpio", "--list"], {
    cwd: process.cwd(),
    stderr: "pipe",
    stdin: rpmProc.stdout,
    stdout: "pipe",
  });

  const [rpmExitCode, cpioExitCode, rpmStderr, cpioStderr, listing] =
    await Promise.all([
      rpmProc.exited,
      cpioProc.exited,
      new Response(rpmProc.stderr).text(),
      new Response(cpioProc.stderr).text(),
      new Response(cpioProc.stdout).text(),
    ]);

  if (rpmExitCode !== 0) {
    throw new CommandExecutionError(
      formatCommand(["rpm2cpio", rpmPath]),
      rpmExitCode,
      shortStderr(rpmStderr),
    );
  }

  if (cpioExitCode !== 0) {
    throw new CommandExecutionError(
      formatCommand(["cpio", "--list"]),
      cpioExitCode,
      shortStderr(cpioStderr),
    );
  }

  return listing
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function validateArchiveSafety(rpmPath: string): Promise<void> {
  const entries = await listArchiveEntries(rpmPath);
  const unsafeEntries = findUnsafeArchiveEntries(entries);

  if (unsafeEntries.length > 0) {
    const preview = unsafeEntries.slice(0, 5).join(", ");
    throw new CliError(
      `${COLORS.RED}Unsafe archive entries detected:${COLORS.NC} ${preview}`,
    );
  }
}

export async function prepareWorkspace(
  options: InstallOptions,
): Promise<Workspace> {
  const absoluteRpmPath = resolvePath(options.rpmPath);

  if (!existsSync(absoluteRpmPath)) {
    throw new CliError(
      `${COLORS.RED}File not found:${COLORS.NC} ${absoluteRpmPath}`,
    );
  }

  if (options.install && !options.targetDir) {
    const tempDir = await mkdtemp(path.join(tmpdir(), "irpm-"));
    return {
      cleanupAfterUse: true,
      targetDir: tempDir,
    };
  }

  const requestedTarget = options.targetDir ?? "extracted_rpm";
  const targetDir = resolvePath(requestedTarget);

  if (existsSync(targetDir)) {
    if (!options.force) {
      throw new CliError(
        `${COLORS.RED}Destination exists:${COLORS.NC} ${targetDir}. Re-run with --force to replace it.`,
      );
    }

    await rm(targetDir, { recursive: true, force: true });
  }

  await mkdir(targetDir, { recursive: true });

  return {
    cleanupAfterUse: false,
    targetDir,
  };
}

async function extractRpm(rpmPath: string, targetDir: string): Promise<void> {
  const { cpio, rpm2cpio } = buildExtractCommands(rpmPath, targetDir);

  console.log(
    `${COLORS.BLUE}info:${COLORS.NC} Extracting ${path.basename(rpmPath)}...`,
  );

  const rpmProc = Bun.spawn(rpm2cpio.argv, {
    cwd: rpm2cpio.cwd ?? process.cwd(),
    stderr: "pipe",
    stdout: "pipe",
  });

  const cpioProc = Bun.spawn(cpio.argv, {
    cwd: cpio.cwd ?? process.cwd(),
    stderr: "pipe",
    stdin: rpmProc.stdout,
    stdout: "inherit",
  });

  const [rpmExitCode, cpioExitCode, rpmStderr, cpioStderr] = await Promise.all([
    rpmProc.exited,
    cpioProc.exited,
    new Response(rpmProc.stderr).text(),
    new Response(cpioProc.stderr).text(),
  ]);

  if (rpmExitCode !== 0) {
    throw new CommandExecutionError(
      formatCommand(rpm2cpio.argv),
      rpmExitCode,
      shortStderr(rpmStderr),
    );
  }

  if (cpioExitCode !== 0) {
    throw new CommandExecutionError(
      formatCommand(cpio.argv),
      cpioExitCode,
      shortStderr(cpioStderr),
    );
  }

  console.log(`${COLORS.GREEN}success:${COLORS.NC} Extraction finished.`);
}

async function confirmStep(message: string): Promise<boolean> {
  process.stdout.write(`${COLORS.YELLOW}??${COLORS.NC} ${message} [y/N]: `);

  for await (const line of console) {
    return line.trim().toLowerCase() === "y";
  }

  return false;
}

async function deployToRoot(sourceDir: string): Promise<void> {
  console.log(
    `${COLORS.BLUE}info:${COLORS.NC} Deploying to root filesystem (sudo required)...`,
  );
  await runCommand(["sudo", "cp", "-a", "--", `${sourceDir}/.`, "/"]);
  console.log(`${COLORS.GREEN}success:${COLORS.NC} Deployment complete.`);
}

async function cleanupWorkspace(
  targetDir: string,
  cleanupAfterUse: boolean,
): Promise<void> {
  if (!cleanupAfterUse) return;
  await rm(targetDir, { recursive: true, force: true });
}

export async function createRunContext(parsed: ParsedCli): Promise<RunContext> {
  const [rpmInput, destInput] = parsed.positionals;

  if (!rpmInput) {
    printUsage();
    throw new CliError("RPM path is required.");
  }

  const absoluteRpmPath = resolvePath(rpmInput);
  const workspace = await prepareWorkspace({
    force: parsed.force,
    install: parsed.install,
    rpmPath: rpmInput,
    targetDir: destInput,
  });

  return {
    absoluteRpmPath,
    install: parsed.install,
    targetDir: workspace.targetDir,
    workspaceCleanupAfterUse: workspace.cleanupAfterUse,
  };
}

export async function run(argv = Bun.argv.slice(2)): Promise<void> {
  const parsed = parseCliArgs(argv);

  if (parsed.help) {
    printUsage();
    return;
  }

  ensureRequiredTools(parsed.install);

  const context = await createRunContext(parsed);

  try {
    await validateArchiveSafety(context.absoluteRpmPath);
    await extractRpm(context.absoluteRpmPath, context.targetDir);

    if (!context.install) {
      console.log(
        `${COLORS.GREEN}success:${COLORS.NC} Extracted to ${context.targetDir}`,
      );
      return;
    }

    const shouldInstall = await confirmStep("Proceed with installation to /?");

    if (shouldInstall) {
      await deployToRoot(context.targetDir);
    } else {
      console.log(`${COLORS.BLUE}info:${COLORS.NC} Installation cancelled.`);
    }
  } finally {
    await cleanupWorkspace(
      context.targetDir,
      context.workspaceCleanupAfterUse,
    );
  }
}

if (import.meta.main) {
  try {
    await run();
  } catch (err) {
    if (err instanceof CommandExecutionError) {
      console.error(`\n${COLORS.RED}RPM processing failed:${COLORS.NC}`);
      console.error(
        `${COLORS.YELLOW}Command:${COLORS.NC} ${err.command}\n${COLORS.YELLOW}Exit code:${COLORS.NC} ${err.exitCode}\n${COLORS.YELLOW}stderr:${COLORS.NC}\n${err.stderr}`,
      );
      process.exit(1);
    }

    if (err instanceof CliError) {
      console.error(`${COLORS.RED}error:${COLORS.NC} ${err.message}`);
      process.exit(err.exitCode);
    }

    console.error(`\n${COLORS.RED}RPM processing failed:${COLORS.NC}`, err);
    process.exit(1);
  }
}
