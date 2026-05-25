#!/usr/bin/env tsx
import { spawnSync } from "child_process";
import { isMain } from "./utils";

function fzfRgEdit(initialQuery: string): void {
  const rgCmd = `rg --column --line-number --no-heading --color=always --smart-case -- ${JSON.stringify(initialQuery).slice(1, -1)}`;
  let result: string;

  const hasBat = spawnSync("which", ["bat"], { stdio: "ignore" }).status === 0;
  const previewCmd = hasBat
    ? "bat --style=numbers --color=always --highlight-line {2} -- {1}"
    : "sed -n '$(( {2} > 5 ? {2} - 5 : 1 )),$(( {2} + 5 ))p' -- {1}";

  const fzf = spawnSync("fzf", [
    "--ansi",
    "--disabled",
    "--query", initialQuery,
    "--bind", "change:reload:rg --column --line-number --no-heading --color=always --smart-case -- {q} || true",
    "--bind", "enter:accept",
    "--delimiter", ":",
    "--nth", "4..",
    "--preview", previewCmd,
    "--preview-window", "up,60%,border-bottom,+{2}+3/3,~3",
  ], {
    env: { ...process.env, FZF_DEFAULT_COMMAND: rgCmd },
    stdio: [undefined, "pipe", "pipe"],
    encoding: "utf-8",
    input: "",
  });

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
    const editor = process.env.EDITOR || "vim";
    spawnSync(editor, [file, `+${line}`], { stdio: "inherit" });
  }
}

function main(): void {
  const query = process.argv.slice(2).join(" ");
  fzfRgEdit(query);
}

if (isMain(import.meta.url)) main();
