import { spawn as nodeSpawn, spawnSync as nodeSpawnSync } from "child_process";
import { accessSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

export const args = process.argv.slice(2);

export function isMain(metaUrl: string): boolean {
  return process.argv[1] === fileURLToPath(metaUrl);
}

export function which(command: string): string | null {
  if (command.includes("/")) {
    try {
      accessSync(command);
      return command;
    } catch {
      return null;
    }
  }
  const paths = process.env.PATH?.split(":") ?? [];
  for (const dir of paths) {
    const fullPath = join(dir, command);
    try {
      accessSync(fullPath);
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
  options?: { cwd?: string; env?: Record<string, string>; stdin?: "ignore" | "pipe" | "inherit" },
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = nodeSpawn(command, cmdArgs, {
      stdio: [options?.stdin ?? "ignore", "pipe", "pipe"],
      cwd: options?.cwd,
      env: options?.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer | string) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer | string) => (stderr += d.toString()));
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });
  });
}

export function spawnSyncOutput(
  command: string,
  cmdArgs: string[],
  options?: { cwd?: string; env?: Record<string, string>; stdin?: "ignore" | "pipe" | "inherit" },
): SpawnResult {
  const result = nodeSpawnSync(command, cmdArgs, {
    stdio: [options?.stdin ?? "ignore", "pipe", "pipe"],
    encoding: "utf-8",
    cwd: options?.cwd,
    env: options?.env,
  });
  return {
    exitCode: result.status ?? 0,
    stdout: result.stdout?.toString() ?? "",
    stderr: result.stderr?.toString() ?? "",
  };
}

export function spawnDetached(command: string, cmdArgs: string[]): void {
  const child = nodeSpawn(command, cmdArgs, {
    stdio: "ignore",
    detached: true,
  });
  child.unref();
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
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
  writeFileSync(path, data, "utf-8");
}

export { fileURLToPath };
