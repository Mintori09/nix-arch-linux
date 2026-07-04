import { join } from "node:path";
import { accessSync, constants, readFileSync, writeFileSync } from "node:fs";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const args = process.argv.slice(2);

export function isMain(metaUrl: string): boolean {
  return process.argv[1] === fileURLToPath(metaUrl);
}

export function which(command: string): string | null {
  if (command.includes("/")) {
    try {
      accessSync(command, constants.X_OK);
      return command;
    } catch {
      return null;
    }
  }
  const paths = (process.env.PATH ?? "").split(":");
  for (const dir of paths) {
    const fullPath = join(dir, command);
    try {
      accessSync(fullPath, constants.X_OK);
      return fullPath;
    } catch {
      continue;
    }
  }
  return null;
}

export type SpawnResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export async function spawnAsync(
  command: string,
  cmdArgs: string[],
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    stdin?: "pipe" | "inherit" | "piped";
  },
): Promise<SpawnResult> {
  const child = spawn(command, cmdArgs, {
    stdio: [
      options?.stdin === "pipe" || options?.stdin === "piped"
        ? "pipe"
        : "ignore",
      "pipe",
      "pipe",
    ],
    cwd: options?.cwd,
    env: options?.env,
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout?.on("data", (d: Buffer) => stdoutChunks.push(d));
  child.stderr?.on("data", (d: Buffer) => stderrChunks.push(d));
  const exitCode = await new Promise<number>((resolve) => {
    child.on("close", resolve);
  });
  return {
    exitCode,
    stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
    stderr: Buffer.concat(stderrChunks).toString("utf-8"),
  };
}

export function spawnSyncOutput(
  command: string,
  cmdArgs: string[],
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    stdin?: "pipe" | "inherit" | "piped";
    input?: string;
  },
): SpawnResult {
  const result = spawnSync(command, cmdArgs, {
    stdio: [
      options?.stdin === "pipe" || options?.stdin === "piped"
        ? "pipe"
        : "ignore",
      "pipe",
      "pipe",
    ],
    input: options?.input,
    cwd: options?.cwd,
    env: options?.env,
    encoding: "utf-8",
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export async function spawnInherit(
  command: string,
  cmdArgs: string[],
  options?: { cwd?: string; env?: Record<string, string> },
): Promise<number> {
  const child = spawn(command, cmdArgs, {
    stdio: "inherit",
    cwd: options?.cwd,
    env: options?.env,
  });
  return new Promise<number>((resolve) => {
    child.on("close", resolve);
  });
}

export function spawnDetached(command: string, cmdArgs: string[]): void {
  spawn(command, cmdArgs, {
    stdio: "ignore",
    detached: true,
  }).unref();
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function readFile(path: string): string {
  return readFileSync(path, "utf-8");
}

export function writeFile(path: string, data: string): void {
  writeFileSync(path, data);
}

export { fileURLToPath } from "node:url";
