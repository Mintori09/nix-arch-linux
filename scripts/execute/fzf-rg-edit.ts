#!/usr/bin/env tsx
import { statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { args, isMain } from "./utils.ts";

function isExistingFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function fzfRgEdit(initialQuery: string, targetFiles: string[] = []): void {
  const fileArgs = targetFiles.map(escapeShellArg).join(" ");
  const rgBaseCmd = "rg -H --column --line-number --no-heading --color=always --smart-case";
  const initialQueryArg = escapeShellArg(initialQuery);

  const rgCmd = fileArgs
    ? `${rgBaseCmd} -e ${initialQueryArg} -- ${fileArgs}`
    : `${rgBaseCmd} -e ${initialQueryArg}`;

  const reloadCmd = fileArgs
    ? `${rgBaseCmd} -e {q} -- ${fileArgs} || true`
    : `${rgBaseCmd} -e {q} || true`;

  let result: string;

  const hasBat = spawnSync("which", ["bat"], { stdio: "ignore" }).status === 0;
  const previewCmd = hasBat
    ? "bat --style=numbers --color=always --highlight-line {2} -- {1}"
    : "sed -n '$(( {2} > 5 ? {2} - 5 : 1 )),$(( {2} + 5 ))p' -- {1}";

  const fzf = spawnSync(
    "fzf",
    [
      "--ansi",
      "--disabled",
      "--query",
      initialQuery,
      "--bind",
      `change:reload:${reloadCmd}`,
      "--bind",
      "enter:accept",
      "--delimiter",
      ":",
      "--nth",
      "4..",
      "--preview",
      previewCmd,
      "--preview-window",
      "up,60%,border-bottom,+{2}+3/3,~3",
    ],
    {
      env: { ...process.env, FZF_DEFAULT_COMMAND: rgCmd },
      stdio: [undefined, "pipe", "pipe"],
      encoding: "utf-8",
      input: "",
    },
  );

  result = fzf.stdout?.trim() ?? "";

  if (!result) return;

  const i = result.indexOf(":");
  if (i === -1) return;
  const file = result.slice(0, i);
  const afterFile = result.slice(i + 1);
  const j = afterFile.indexOf(":");
  if (j === -1) return;
  const line = afterFile.slice(0, j);

  if (file && line) {
    const editor = "nvim";
    spawnSync(editor, [file, `+${line}`], { stdio: "inherit" });
  }
}

function main(): void {
  const targetFiles: string[] = [];
  const queryParts: string[] = [];

  for (const arg of args) {
    if (isExistingFile(arg)) {
      targetFiles.push(arg);
    } else {
      queryParts.push(arg);
    }
  }

  const query = queryParts.join(" ");
  fzfRgEdit(query, targetFiles);
}

if (isMain(import.meta.url)) main();

