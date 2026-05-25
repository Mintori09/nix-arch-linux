#!/usr/bin/env deno run -A

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { homedir, tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { args, isMain, which } from "./utils.ts";

const COLORS = {
  BLUE: "\x1b[34m",
  GREEN: "\x1b[32m",
  RED: "\x1b[31m",
  YELLOW: "\x1b[33m",
  NC: "\x1b[0m",
} as const;

const REQUIRED_TOOLS = ["rpm2cpio", "cpio"] as const;
const DENIED_PREFIXES = [
  "boot/",
  "dev/",
  "etc/",
  "proc/",
  "root/",
  "run/",
  "sbin/",
  "srv/",
  "sys/",
  "tmp/",
  "var/",
  "usr/lib/modules/",
  "usr/lib/systemd/",
  "usr/lib/udev/",
  "usr/libexec/",
  "usr/local/",
  "usr/sbin/",
] as const;
const ALLOWED_PREFIXES = ["usr/", "opt/"] as const;
const MANAGED_HEADER = "# managed-by-irpm";
const SETUID_MASK = 0o6000;

type CommandName = "extract" | "install" | "list" | "remove";

type CommandOptions = {
  captureStdout?: boolean;
};

type ParsedCli = {
  command: CommandName;
  force: boolean;
  help: boolean;
  idsOnly: boolean;
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
  absoluteRpmPath?: string;
  command: CommandName;
  install: boolean;
  installId?: string;
  targetDir?: string;
  workspaceCleanupAfterUse: boolean;
};

type XdgLayout = {
  applicationsDir: string;
  binDir: string;
  dataHome: string;
  iconsDir: string;
  installStoreDir: string;
  manifestsDir: string;
  pixmapsDir: string;
  stateHome: string;
};

type InstallManifest = {
  commands: string[];
  desktopEntries: string[];
  id: string;
  installedAt: string;
  publishedPaths: string[];
  rpmSha256: string;
  sourceFile: string;
  stageDir: string;
};

type InstallExtractedTreeOptions = {
  env?: Record<string, string | undefined>;
  extractedRoot: string;
  force: boolean;
  installId?: string;
  rpmPath: string;
};

type InstallExtractedTreeResult = {
  manifest: InstallManifest;
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
  console.log(`irpm - extract RPM payloads and publish user-level installs safely

Usage:
  irpm <path-to-rpm> [destination-folder]
  irpm extract <path-to-rpm> [destination-folder]
  irpm install [--force|-f] <path-to-rpm>
  irpm remove <install-id>
  irpm list [--ids]

Legacy aliases:
  irpm --install <path-to-rpm>
  irpm --remove <install-id>

Behavior:
  irpm package.rpm
    Extracts to ./extracted_rpm

  irpm install package.rpm
    Extracts to a temporary directory and publishes managed files under ~/.local

  irpm remove hello-rpm
    Removes manifest-owned wrappers, desktop entries, icons, and staged payload

Options:
  -f, --force    replace an existing managed install with the same install id
  -h, --help     show this help message
  --ids          print only install ids when used with list
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

function isFlag(value: string): boolean {
  return value.startsWith("-");
}

export function parseCliArgs(argv: string[]): ParsedCli {
  let command: CommandName = "extract";
  let force = false;
  let help = false;
  let idsOnly = false;
  let install = false;
  const positionals: string[] = [];

  for (const arg of argv) {
    if (arg === "--force" || arg === "-f") {
      force = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--ids") {
      idsOnly = true;
      continue;
    }

    if (arg === "--install" || arg === "-i") {
      command = "install";
      install = true;
      continue;
    }

    if (arg === "--remove") {
      command = "remove";
      continue;
    }

    if (
      positionals.length === 0 &&
      !isFlag(arg) &&
      (arg === "extract" || arg === "install" || arg === "list" || arg === "remove")
    ) {
      command = arg;
      install = arg === "install";
      continue;
    }

    positionals.push(arg);
  }

  if (command === "install") {
    install = true;
  }

  return {
    command,
    force,
    help,
    idsOnly,
    install,
    positionals,
  };
}

function resolvePath(inputPath: string): string {
  return path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(Deno.cwd(), inputPath);
}

export function ensureRequiredTools(
  _install: boolean,
  toolResolver: (tool: string) => string | null = which,
): void {
  const missing = REQUIRED_TOOLS.filter((tool) => !toolResolver(tool));

  if (missing.length > 0) {
    throw new CliError(
      `${COLORS.RED}Missing dependencies:${COLORS.NC} ${missing.join(", ")}`,
    );
  }
}

async function runCommand(
  parts: readonly string[],
  options: CommandOptions = {},
): Promise<string> {
  const command = formatCommand(parts);
  const proc = spawn(parts[0], parts.slice(1), {
    cwd: Deno.cwd(),
    stdio: ["ignore", options.captureStdout ? "pipe" : "inherit", "pipe"],
  });

  let stderr = "";
  let stdout = "";
  proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
  if (options.captureStdout) {
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
  }

  const exitCode = await new Promise<number>((resolve) => proc.on("close", resolve));

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

export function validateInstallableEntries(entries: readonly string[]): string[] {
  return entries.filter((entry) => {
    const trimmed = normalizeArchiveEntry(entry.trim());
    if (!trimmed || trimmed === ".") return false;

    if (DENIED_PREFIXES.some((prefix) => trimmed === prefix.slice(0, -1) || trimmed.startsWith(prefix))) {
      return true;
    }

    return !ALLOWED_PREFIXES.some(
      (prefix) => trimmed === prefix.slice(0, -1) || trimmed.startsWith(prefix),
    );
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
  const rpmProc = spawn("rpm2cpio", [rpmPath], {
    cwd: Deno.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  const cpioProc = spawn("cpio", ["--list"], {
    cwd: Deno.cwd(),
    stdio: [rpmProc.stdout, "pipe", "pipe"],
  });

  let rpmStderr = "";
  let cpioStderr = "";
  let listing = "";
  rpmProc.stderr.on("data", (d: Buffer) => (rpmStderr += d.toString()));
  cpioProc.stderr.on("data", (d: Buffer) => (cpioStderr += d.toString()));
  cpioProc.stdout.on("data", (d: Buffer) => (listing += d.toString()));

  const [rpmExitCode, cpioExitCode] = await Promise.all([
    new Promise<number>((r) => rpmProc.on("close", r)),
    new Promise<number>((r) => cpioProc.on("close", r)),
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

async function validateArchiveInstallability(rpmPath: string): Promise<void> {
  const entries = await listArchiveEntries(rpmPath);
  const disallowed = validateInstallableEntries(entries);

  if (disallowed.length > 0) {
    const preview = disallowed.slice(0, 5).join(", ");
    throw new CliError(
      `${COLORS.RED}Unsupported system-level RPM paths:${COLORS.NC} ${preview}`,
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
    const targetDir = await mkdtemp(path.join(tmpdir(), "irpm-"));
    return {
      cleanupAfterUse: true,
      targetDir,
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

  const rpmProc = spawn(rpm2cpio.argv[0], rpm2cpio.argv.slice(1), {
    cwd: rpm2cpio.cwd ?? Deno.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  const cpioProc = spawn(cpio.argv[0], cpio.argv.slice(1), {
    cwd: cpio.cwd ?? Deno.cwd(),
    stdio: [rpmProc.stdout, "inherit", "pipe"],
  });

  let rpmStderr = "";
  let cpioStderr = "";
  rpmProc.stderr.on("data", (d: Buffer) => (rpmStderr += d.toString()));
  cpioProc.stderr.on("data", (d: Buffer) => (cpioStderr += d.toString()));

  const [rpmExitCode, cpioExitCode] = await Promise.all([
    new Promise<number>((r) => rpmProc.on("close", r)),
    new Promise<number>((r) => cpioProc.on("close", r)),
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

async function cleanupWorkspace(
  targetDir: string | undefined,
  cleanupAfterUse: boolean,
): Promise<void> {
  if (!cleanupAfterUse || !targetDir) return;
  await rm(targetDir, { recursive: true, force: true });
}

function resolveXdgLayout(env: Record<string, string | undefined>): XdgLayout {
  const home = env.HOME || homedir();
  const dataHome = env.XDG_DATA_HOME || path.join(home, ".local/share");
  const stateHome = env.XDG_STATE_HOME || path.join(home, ".local/state");

  return {
    applicationsDir: path.join(dataHome, "applications"),
    binDir: path.join(home, ".local/bin"),
    dataHome,
    iconsDir: path.join(dataHome, "icons"),
    installStoreDir: path.join(dataHome, "irpm/packages"),
    manifestsDir: path.join(stateHome, "irpm/installs"),
    pixmapsDir: path.join(dataHome, "pixmaps"),
    stateHome,
  };
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

function isPathWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function walkRelativePaths(root: string, current = ""): Promise<string[]> {
  const absoluteCurrent = path.join(root, current);
  const entries = await readdir(absoluteCurrent, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const relative = path.join(current, entry.name);
    results.push(relative);

    if (entry.isDirectory()) {
      results.push(...(await walkRelativePaths(root, relative)));
    }
  }

  return results;
}

export async function auditExtractedTree(root: string): Promise<void> {
  const entries = await walkRelativePaths(root);

  for (const relative of entries) {
    const absolute = path.join(root, relative);
    const stats = await lstat(absolute);

    if (stats.isSymbolicLink()) {
      const target = await readlink(absolute);
      const resolved = path.resolve(path.dirname(absolute), target);
      if (!isPathWithin(root, resolved)) {
        throw new CliError(
          `${COLORS.RED}Symlink escapes extracted root:${COLORS.NC} ${relative}`,
        );
      }
      continue;
    }

    if (stats.isDirectory() || stats.isFile()) {
      if (stats.isFile() && (stats.mode & SETUID_MASK) !== 0) {
        throw new CliError(
          `${COLORS.RED}Refusing setuid or setgid payload:${COLORS.NC} ${relative}`,
        );
      }
      continue;
    }

    throw new CliError(
      `${COLORS.RED}Unsupported special file in payload:${COLORS.NC} ${relative}`,
    );
  }
}

async function collectExecutableFiles(root: string): Promise<string[]> {
  const candidates: string[] = [];
  const allEntries = await walkRelativePaths(root);

  for (const relative of allEntries) {
    const normalized = relative.split(path.sep).join(path.posix.sep);
    if (
      normalized.startsWith("usr/bin/") ||
      /^opt\/.+\/bin\/[^/]+$/.test(normalized)
    ) {
      const absolute = path.join(root, relative);
      const stats = await stat(absolute);
      if (stats.isFile() && (stats.mode & 0o111) !== 0) {
        candidates.push(absolute);
      }
    }
  }

  return candidates.sort();
}

async function collectFilesUnder(root: string, relativeDir: string): Promise<string[]> {
  const absoluteDir = path.join(root, relativeDir);
  if (!existsSync(absoluteDir)) return [];

  const collected = await walkRelativePaths(absoluteDir);
  return collected
    .filter((relative) => relative !== "" && !relative.endsWith(path.sep))
    .map((relative) => path.join(absoluteDir, relative))
    .filter((absolute) => !absolute.endsWith(path.sep));
}

async function collectDataDirectories(root: string): Promise<string[]> {
  const candidates = [path.join(root, "usr/share")];
  const optDir = path.join(root, "opt");

  if (existsSync(optDir)) {
    const topLevel = await readdir(optDir, { withFileTypes: true });
    for (const entry of topLevel) {
      if (!entry.isDirectory()) continue;
      const shareDir = path.join(optDir, entry.name, "share");
      if (existsSync(shareDir)) {
        candidates.push(shareDir);
      }
    }
  }

  return candidates.filter((dir, index, all) => existsSync(dir) && all.indexOf(dir) === index);
}

async function collectLibraryDirectories(root: string): Promise<string[]> {
  const candidates = [path.join(root, "usr/lib"), path.join(root, "usr/lib64")];
  const optDir = path.join(root, "opt");

  if (existsSync(optDir)) {
    const topLevel = await readdir(optDir, { withFileTypes: true });
    for (const entry of topLevel) {
      if (!entry.isDirectory()) continue;
      const base = path.join(optDir, entry.name);
      for (const libName of ["lib", "lib64"]) {
        const candidate = path.join(base, libName);
        if (existsSync(candidate)) {
          candidates.push(candidate);
        }
      }
    }
  }

  return candidates.filter((dir, index, all) => existsSync(dir) && all.indexOf(dir) === index);
}

function buildWrapperScript(options: {
  commandPath: string;
  dataDirs: string[];
  installId: string;
  libraryDirs: string[];
  pathDirs: string[];
}): string {
  const exportPath = options.pathDirs.join(":");
  const exportLibraries = options.libraryDirs.join(":");
  const exportDataDirs = options.dataDirs.join(":");

  return [
    "#!/usr/bin/env bash",
    `# managed-by-irpm ${options.installId}`,
    "set -euo pipefail",
    `export PATH="${exportPath}:$PATH"`,
    `export LD_LIBRARY_PATH="${exportLibraries}\${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"`,
    `export XDG_DATA_DIRS="${exportDataDirs}\${XDG_DATA_DIRS:+:$XDG_DATA_DIRS}"`,
    `exec ${shellEscape(options.commandPath)} "$@"`,
    "",
  ].join("\n");
}

async function ensurePublishTargetAvailable(targetPath: string): Promise<void> {
  if (!existsSync(targetPath)) return;
  throw new CliError(
    `${COLORS.RED}Managed publish target already exists:${COLORS.NC} ${targetPath}`,
  );
}

async function publishWrappers(options: {
  installId: string;
  layout: XdgLayout;
  stageDir: string;
}): Promise<{ commands: string[]; publishedPaths: string[] }> {
  const commandPaths = await collectExecutableFiles(options.stageDir);
  if (commandPaths.length === 0) {
    return { commands: [], publishedPaths: [] };
  }

  await ensureDir(options.layout.binDir);

  const dataDirs = await collectDataDirectories(options.stageDir);
  const libraryDirs = await collectLibraryDirectories(options.stageDir);
  const pathDirs = Array.from(
    new Set(commandPaths.map((commandPath) => path.dirname(commandPath))),
  );
  const commands: string[] = [];
  const publishedPaths: string[] = [];

  for (const commandPath of commandPaths) {
    const commandName = path.basename(commandPath);
    const wrapperPath = path.join(options.layout.binDir, commandName);
    await ensurePublishTargetAvailable(wrapperPath);
    await writeFile(
      wrapperPath,
      buildWrapperScript({
        commandPath,
        dataDirs,
        installId: options.installId,
        libraryDirs,
        pathDirs,
      }),
    );
    await chmod(wrapperPath, 0o755);
    commands.push(commandName);
    publishedPaths.push(wrapperPath);
  }

  return { commands, publishedPaths };
}

function rewriteDesktopEntry(
  source: string,
  installId: string,
  wrappersByName: Map<string, string>,
): string | null {
  let rewroteExec = false;
  const lines = source.split(/\r?\n/);
  const rewritten = lines.map((line) => {
    if (!line.startsWith("Exec=")) return line;

    const value = line.slice("Exec=".length).trim();
    if (!value) return line;

    const [commandToken, ...rest] = value.split(/\s+/);
    const commandName = path.basename(commandToken);
    const wrapperPath = wrappersByName.get(commandName);
    if (!wrapperPath) return line;

    rewroteExec = true;
    return `Exec=${[wrapperPath, ...rest].join(" ")}`.trim();
  });

  if (!rewroteExec) {
    return null;
  }

  return [`${MANAGED_HEADER} ${installId}`, ...rewritten].join("\n");
}

async function publishDesktopEntries(options: {
  installId: string;
  layout: XdgLayout;
  stageDir: string;
  wrappersByName: Map<string, string>;
}): Promise<{ desktopEntries: string[]; publishedPaths: string[] }> {
  const appsDir = path.join(options.stageDir, "usr/share/applications");
  if (!existsSync(appsDir)) {
    return { desktopEntries: [], publishedPaths: [] };
  }

  await ensureDir(options.layout.applicationsDir);
  const desktopFiles = (await collectFilesUnder(options.stageDir, "usr/share/applications"))
    .filter((absolute) => absolute.endsWith(".desktop"))
    .sort();
  const desktopEntries: string[] = [];
  const publishedPaths: string[] = [];

  for (const sourcePath of desktopFiles) {
    const source = await readFile(sourcePath, "utf8");
    const rewritten = rewriteDesktopEntry(
      source,
      options.installId,
      options.wrappersByName,
    );

    if (rewritten === null) continue;

    const targetPath = path.join(
      options.layout.applicationsDir,
      path.basename(sourcePath),
    );
    await ensurePublishTargetAvailable(targetPath);
    await writeFile(targetPath, rewritten);
    desktopEntries.push(path.basename(sourcePath));
    publishedPaths.push(targetPath);
  }

  return { desktopEntries, publishedPaths };
}

async function publishSymlinkTree(options: {
  destinationDir: string;
  sourceDir: string;
}): Promise<string[]> {
  if (!existsSync(options.sourceDir)) return [];
  await ensureDir(options.destinationDir);
  const files = await collectFilesUnder(options.sourceDir, ".");
  const published: string[] = [];

  for (const sourcePath of files) {
    const stats = await lstat(sourcePath);
    if (!stats.isFile() && !stats.isSymbolicLink()) continue;
    const targetPath = path.join(options.destinationDir, path.basename(sourcePath));
    await ensurePublishTargetAvailable(targetPath);
    await symlink(sourcePath, targetPath);
    published.push(targetPath);
  }

  return published;
}

async function removeFileIfManaged(filePath: string, installId: string, stageDir: string): Promise<void> {
  if (!existsSync(filePath)) return;

  const stats = await lstat(filePath);
  if (stats.isSymbolicLink()) {
    const target = await readlink(filePath);
    const resolved = path.resolve(path.dirname(filePath), target);
    if (isPathWithin(stageDir, resolved)) {
      await rm(filePath, { force: true });
    }
    return;
  }

  if (stats.isFile()) {
    const body = await readFile(filePath, "utf8").catch(() => "");
    if (body.startsWith(`${MANAGED_HEADER} ${installId}`) || body.includes(`# managed-by-irpm ${installId}`)) {
      await rm(filePath, { force: true });
    }
  }
}

function sanitizeInstallId(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.rpm$/i, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "rpm-package";
}

async function hashFile(filePath: string): Promise<string> {
  const buffer = readFileSync(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function buildInstallId(rpmPath: string): Promise<string> {
  const hash = await hashFile(rpmPath);
  return `${sanitizeInstallId(path.basename(rpmPath))}-${hash.slice(0, 8)}`;
}

async function readManifest(manifestPath: string): Promise<InstallManifest> {
  return JSON.parse(await readFile(manifestPath, "utf8")) as InstallManifest;
}

export async function listInstalledPackageIds(
  env: Record<string, string | undefined> = Deno.env.toObject(),
): Promise<string[]> {
  const layout = resolveXdgLayout(env);
  if (!existsSync(layout.manifestsDir)) return [];

  const entries = await readdir(layout.manifestsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/, ""))
    .sort();
}

export async function removeInstalledPackage(
  installId: string,
  env: Record<string, string | undefined> = Deno.env.toObject(),
): Promise<void> {
  const layout = resolveXdgLayout(env);
  const manifestPath = path.join(layout.manifestsDir, `${installId}.json`);

  if (!existsSync(manifestPath)) {
    throw new CliError(
      `${COLORS.RED}Managed install not found:${COLORS.NC} ${installId}`,
      2,
    );
  }

  const manifest = await readManifest(manifestPath);

  for (const publishedPath of manifest.publishedPaths) {
    await removeFileIfManaged(publishedPath, manifest.id, manifest.stageDir);
  }

  await rm(manifest.stageDir, { recursive: true, force: true });
  await rm(manifestPath, { force: true });
}

export async function installExtractedTree(
  options: InstallExtractedTreeOptions,
): Promise<InstallExtractedTreeResult> {
  const env = options.env ?? Deno.env.toObject();
  const layout = resolveXdgLayout(env);
  const installId = options.installId ?? (await buildInstallId(options.rpmPath));
  const manifestPath = path.join(layout.manifestsDir, `${installId}.json`);
  const stageDir = path.join(layout.installStoreDir, installId, "root");
  const entries = await walkRelativePaths(options.extractedRoot);
  const disallowed = validateInstallableEntries(entries);

  if (disallowed.length > 0) {
    const preview = disallowed.slice(0, 5).join(", ");
    throw new CliError(
      `${COLORS.RED}Unsupported system-level RPM paths:${COLORS.NC} ${preview}`,
    );
  }

  await auditExtractedTree(options.extractedRoot);

  if (existsSync(manifestPath)) {
    if (!options.force) {
      throw new CliError(
        `${COLORS.RED}Managed install already exists:${COLORS.NC} ${installId}`,
      );
    }

    await removeInstalledPackage(installId, env);
  }

  await ensureDir(path.dirname(stageDir));
  await ensureDir(layout.manifestsDir);
  await rm(stageDir, { recursive: true, force: true });
  await cp(options.extractedRoot, stageDir, { recursive: true });

  const publishedPaths: string[] = [];
  const wrapperResult = await publishWrappers({
    installId,
    layout,
    stageDir,
  });
  publishedPaths.push(...wrapperResult.publishedPaths);

  const wrappersByName = new Map(
    wrapperResult.commands.map((command) => [
      command,
      path.join(layout.binDir, command),
    ]),
  );

  const desktopResult = await publishDesktopEntries({
    installId,
    layout,
    stageDir,
    wrappersByName,
  });
  publishedPaths.push(...desktopResult.publishedPaths);

  const pixmapPaths = await publishSymlinkTree({
    destinationDir: layout.pixmapsDir,
    sourceDir: path.join(stageDir, "usr/share/pixmaps"),
  });
  publishedPaths.push(...pixmapPaths);

  const iconPaths = await publishSymlinkTree({
    destinationDir: layout.iconsDir,
    sourceDir: path.join(stageDir, "usr/share/icons"),
  });
  publishedPaths.push(...iconPaths);

  if (publishedPaths.length === 0) {
    await rm(stageDir, { recursive: true, force: true });
    throw new CliError(
      `${COLORS.RED}No publishable user-level artifacts found:${COLORS.NC} ${options.rpmPath}`,
    );
  }

  const manifest: InstallManifest = {
    commands: wrapperResult.commands,
    desktopEntries: desktopResult.desktopEntries,
    id: installId,
    installedAt: new Date().toISOString(),
    publishedPaths,
    rpmSha256: await hashFile(options.rpmPath),
    sourceFile: resolvePath(options.rpmPath),
    stageDir,
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return { manifest };
}

export async function createRunContext(parsed: ParsedCli): Promise<RunContext> {
  if (parsed.command === "list") {
    return {
      command: "list",
      install: false,
      workspaceCleanupAfterUse: false,
    };
  }

  if (parsed.command === "remove") {
    const [installId] = parsed.positionals;

    if (!installId) {
      printUsage();
      throw new CliError("Install id is required.");
    }

    return {
      command: "remove",
      install: false,
      installId,
      workspaceCleanupAfterUse: false,
    };
  }

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
    targetDir: parsed.command === "extract" ? destInput : undefined,
  });

  return {
    absoluteRpmPath,
    command: parsed.command,
    install: parsed.install,
    targetDir: workspace.targetDir,
    workspaceCleanupAfterUse: workspace.cleanupAfterUse,
  };
}

async function printInstalledPackages(idsOnly: boolean): Promise<void> {
  const ids = await listInstalledPackageIds();
  if (idsOnly) {
    for (const id of ids) {
      console.log(id);
    }
    return;
  }

  if (ids.length === 0) {
    console.log("No managed installs.");
    return;
  }

  for (const id of ids) {
    console.log(id);
  }
}

export async function run(argv = args): Promise<void> {
  const parsed = parseCliArgs(argv);

  if (parsed.help) {
    printUsage();
    return;
  }

  if (parsed.command === "list") {
    await printInstalledPackages(parsed.idsOnly);
    return;
  }

  if (parsed.command === "remove") {
    const context = await createRunContext(parsed);
    await removeInstalledPackage(context.installId!);
    console.log(
      `${COLORS.GREEN}success:${COLORS.NC} Removed managed install ${context.installId}`,
    );
    return;
  }

  ensureRequiredTools(parsed.install);

  const context = await createRunContext(parsed);

  try {
    await validateArchiveSafety(context.absoluteRpmPath!);
    if (context.command === "install") {
      await validateArchiveInstallability(context.absoluteRpmPath!);
    }
    await extractRpm(context.absoluteRpmPath!, context.targetDir!);

    if (context.command === "extract") {
      console.log(
        `${COLORS.GREEN}success:${COLORS.NC} Extracted to ${context.targetDir}`,
      );
      return;
    }

    const result = await installExtractedTree({
      extractedRoot: context.targetDir!,
      force: parsed.force,
      rpmPath: context.absoluteRpmPath!,
    });
    console.log(
      `${COLORS.GREEN}success:${COLORS.NC} Installed ${result.manifest.id} into managed user directories.`,
    );
  } finally {
    await cleanupWorkspace(context.targetDir, context.workspaceCleanupAfterUse);
  }
}

if (isMain(import.meta.url)) {
  (async () => {
    try {
      await run();
    } catch (err) {
    if (err instanceof CommandExecutionError) {
      console.error(`\n${COLORS.RED}RPM processing failed:${COLORS.NC}`);
      console.error(
        `${COLORS.YELLOW}Command:${COLORS.NC} ${err.command}\n${COLORS.YELLOW}Exit code:${COLORS.NC} ${err.exitCode}\n${COLORS.YELLOW}stderr:${COLORS.NC}\n${err.stderr}`,
      );
      Deno.exit(1);
    }

    if (err instanceof CliError) {
      console.error(`${COLORS.RED}error:${COLORS.NC} ${err.message}`);
      Deno.exit(err.exitCode);
    }

    console.error(`\n${COLORS.RED}RPM processing failed:${COLORS.NC}`, err);
    Deno.exit(1);
  }
  })();
}
