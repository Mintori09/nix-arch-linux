import { join } from "node:path";
import { accessSync, constants } from "node:fs";

export const args = Deno.args;

export function isMain(metaUrl: string): boolean {
  return Deno.mainModule === metaUrl;
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
  const paths = Deno.env.get("PATH")?.split(":") ?? [];
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
  options?: { cwd?: string; env?: Record<string, string>; stdin?: "ignore" | "pipe" | "inherit" | "piped" },
): Promise<SpawnResult> {
  const cmd = new Deno.Command(command, {
    args: cmdArgs,
    stdout: "piped",
    stderr: "piped",
    stdin: options?.stdin === "pipe" || options?.stdin === "piped" ? "piped" : options?.stdin ?? "null",
    cwd: options?.cwd,
    env: options?.env,
  });
  const { code, stdout, stderr } = await cmd.output();
  return {
    exitCode: code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

export function spawnSyncOutput(
  command: string,
  cmdArgs: string[],
  options?: { cwd?: string; env?: Record<string, string>; stdin?: "ignore" | "pipe" | "inherit" | "piped"; input?: string },
): SpawnResult {
  const cmd = new Deno.Command(command, {
    args: cmdArgs,
    stdout: "piped",
    stderr: "piped",
    stdin: options?.stdin === "pipe" || options?.stdin === "piped" ? "piped" : options?.stdin ?? "null",
    cwd: options?.cwd,
    env: options?.env,
  });
  const { code, stdout, stderr } = cmd.outputSync();
  return {
    exitCode: code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

export function spawnDetached(command: string, cmdArgs: string[]): void {
  const cmd = new Deno.Command(command, {
    args: cmdArgs,
    stdout: "null",
    stderr: "null",
    stdin: "null",
  });
  cmd.spawn();
}

export async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = Deno.stdin.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(result);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function readFile(path: string): string {
  return Deno.readTextFileSync(path);
}

export function writeFile(path: string, data: string): void {
  Deno.writeTextFileSync(path, data);
}

export { fileURLToPath } from "node:url";