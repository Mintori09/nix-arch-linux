import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { CommandExecutionError } from "../errors.ts";
import { COLORS } from "../utils.ts";

export type CommandOptions = {
  dryRun: boolean;
  captureStdout?: boolean;
};

export function shellEscape(value: string): string {
  if (/^[a-zA-Z0-9_./:@=+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function formatCommand(parts: readonly string[]): string {
  return parts.map(shellEscape).join(" ");
}

export function shortStderr(
  stderr: string,
  maxLines = 8,
  maxChars = 700,
): string {
  const trimmed = stderr.trim();
  if (!trimmed) return "(empty stderr)";
  const lines = trimmed.split("\n").slice(0, maxLines).join("\n");
  return lines.length <= maxChars ? lines : `${lines.slice(0, maxChars)}...`;
}

export async function runCommand(
  parts: readonly string[],
  options: CommandOptions = { dryRun: false },
): Promise<string> {
  const command = formatCommand(parts);
  if (options.dryRun) {
    console.log(`${COLORS.YELLOW}[dry-run]${COLORS.NC} ${command}`);
    return "";
  } else {
    console.log(`${COLORS.YELLOW}[run]${COLORS.NC} ${command}`);
  }

  const proc = spawn(parts[0], parts.slice(1), {
    stdio: ["ignore", options.captureStdout ? "pipe" : "inherit", "pipe"],
  });

  let stderr = "";
  let stdout = "";
  proc.stderr!.on("data", (d: Buffer) => (stderr += d.toString()));
  if (options.captureStdout) {
    proc.stdout!.on("data", (d: Buffer) => (stdout += d.toString()));
  }

  const exitCode = await new Promise<number>((r) => proc.on("close", r));

  if (exitCode !== 0) {
    throw new CommandExecutionError(command, shortStderr(stderr), exitCode);
  }

  return stdout;
}
