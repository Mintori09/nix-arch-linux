#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { basename, extname } from "node:path";
import { args, isMain, readStdin } from "./utils.ts";

const NAMED_DELIMITERS: Record<string, string> = {
  tab: "\t",
  backspace: "\b",
  null: "\0",
  newline: "\n",
  space: " ",
  comma: ",",
  colon: ":",
};

export class Item {
  constructor(
    readonly value: string,
    readonly number: number,
  ) {}
  get index(): number {
    return this.number - 1;
  }
}

export function parseArgs(): {
  command: string;
  json: boolean;
  split: string;
  dryRun: boolean;
  failFast: boolean;
  keepEmpty: boolean;
  quiet: boolean;
} {
  const cliArgs = args;
  let command = "";
  const opts: Record<string, string | boolean> = {
    json: false,
    split: "line",
    dryRun: false,
    failFast: false,
    keepEmpty: false,
    quiet: false,
  };

  let i = 0;
  while (i < cliArgs.length) {
    const arg = cliArgs[i];
    if (arg === "--json") {
      opts.json = true;
      i++;
      continue;
    }
    if (arg.startsWith("--split=")) {
      opts.split = arg.split("=")[1];
      i++;
      continue;
    }
    if (arg === "--split") {
      opts.split = cliArgs[i + 1];
      i += 2;
      continue;
    }
    if (arg === "--dry-run") {
      opts.dryRun = true;
      i++;
      continue;
    }
    if (arg === "--fail-fast") {
      opts.failFast = true;
      i++;
      continue;
    }
    if (arg === "--keep-empty") {
      opts.keepEmpty = true;
      i++;
      continue;
    }
    if (arg === "--quiet") {
      opts.quiet = true;
      i++;
      continue;
    }
    if (arg === "--help") {
      console.log(`Usage: each [options] <command>

Options:
  --json            Parse stdin as JSON array
  --split MODE|DELIM Split mode or custom delimiter. Built-in: line (default),
                     whitespace, blank, none. Named delimiters: tab, backspace,
                     null, newline, space, comma, colon. Any other value used as
                     literal delimiter string.
  --dry-run         Print commands without executing
  --fail-fast       Stop on first failure
  --keep-empty      Keep empty items
  --quiet           Hide progress output
  --help            Show this message

Placeholders in command:
  {}              Shell-quoted item value
  {raw}           Raw item value (not quoted)
  {filename}      Basename (file.txt)
  {stem}          Basename without extension (file)
  {ext}           Extension with dot (.txt)
  {kebab}         kebab-case of value
  {camel}         camelCase of value
  {pascal}        PascalCase of value
  {snake}         snake_case of value
  {lower}         lowercase of value
  {upper}         UPPERCASE of value
  {kebab-fn}      kebab-case of filename
  {camel-fn}      camelCase of filename
  {pascal-fn}     PascalCase of filename
  {snake-fn}      snake_case of filename
  {lower-fn}      lowercase of filename
  {upper-fn}      UPPERCASE of filename
  {kebab-stem}    kebab-case of stem
  {camel-stem}    camelCase of stem
  {pascal-stem}   PascalCase of stem
  {snake-stem}    snake_case of stem
  {lower-stem}    lowercase of stem
  {upper-stem}    UPPERCASE of stem
  {n}             1-based item number
  {i}             0-based item number`);
      process.exit(0);
    }
    command = cliArgs.slice(i).join(" ");
    break;
  }

  if (!command) {
    console.error("Error: command template is required");
    process.exit(1);
  }

  return {
    command,
    json: opts.json as boolean,
    split: opts.split as string,
    dryRun: opts.dryRun as boolean,
    failFast: opts.failFast as boolean,
    keepEmpty: opts.keepEmpty as boolean,
    quiet: opts.quiet as boolean,
  };
}

export function stringifyJsonItem(item: unknown): string {
  if (typeof item === "string") return item;
  return JSON.stringify(item, undefined, undefined);
}

export function parseStdin(
  text: string,
  useJson: boolean,
  splitMode: string,
  keepEmpty: boolean,
): string[] {
  if (useJson) {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (exc: any) {
      console.error(`Invalid JSON stdin: ${exc.message}`);
      process.exit(1);
    }
    if (!Array.isArray(value)) {
      console.error("JSON stdin must be an array.");
      process.exit(1);
    }
    return value.map(stringifyJsonItem);
  }

  let items: string[];

  if (splitMode === "none") {
    items = [text];
  } else if (splitMode === "line") {
    items = text.split("\n");
  } else if (splitMode === "whitespace") {
    items = text.split(/\s+/);
  } else if (splitMode === "blank") {
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    items = splitByBlankLines(normalized, keepEmpty);
  } else {
    const delimiter = NAMED_DELIMITERS[splitMode] ?? splitMode;
    items = text.split(delimiter);
  }

  if (keepEmpty) return items;
  return items.map((i) => i.trim()).filter((i) => i.length > 0);
}

export function splitByBlankLines(text: string, keepEmpty: boolean): string[] {
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of text.split("\n")) {
    if (line.trim() === "") {
      if (current.length > 0 || keepEmpty) {
        blocks.push(current.join("\n"));
        current = [];
      }
    } else {
      current.push(line);
    }
  }

  if (current.length > 0 || keepEmpty) {
    blocks.push(current.join("\n"));
  }

  return blocks;
}

export function makeItems(values: string[]): Item[] {
  return values.map((value, idx) => new Item(value, idx + 1));
}

function quoteIfNeeded(s: string): string {
  return s.includes(" ") ? `'${s.replace(/'/g, "'\\''")}'` : s;
}

function toKebab(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

function toCamel(s: string): string {
  s = s.replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase());
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function toPascal(s: string): string {
  return s
    .replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());
}

function toSnake(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

export function renderCommand(template: string, item: Item): string {
  const quotedValue = `'${item.value.replace(/'/g, "'\\''")}'`;
  const filename = basename(item.value);
  const stem = basename(item.value, extname(item.value));
  const ext = extname(item.value);

  let cmd = template.replace("{}", quotedValue);
  cmd = cmd.replace("{raw}", item.value);
  cmd = cmd.replace("{filename}", quoteIfNeeded(filename));
  cmd = cmd.replace("{stem}", quoteIfNeeded(stem));
  cmd = cmd.replace("{ext}", ext);

  cmd = cmd.replace("{kebab}", toKebab(item.value));
  cmd = cmd.replace("{camel}", toCamel(item.value));
  cmd = cmd.replace("{pascal}", toPascal(item.value));
  cmd = cmd.replace("{snake}", toSnake(item.value));
  cmd = cmd.replace("{lower}", item.value.toLowerCase());
  cmd = cmd.replace("{upper}", item.value.toUpperCase());

  cmd = cmd.replace("{kebab-fn}", toKebab(filename));
  cmd = cmd.replace("{camel-fn}", toCamel(filename));
  cmd = cmd.replace("{pascal-fn}", toPascal(filename));
  cmd = cmd.replace("{snake-fn}", toSnake(filename));
  cmd = cmd.replace("{lower-fn}", filename.toLowerCase());
  cmd = cmd.replace("{upper-fn}", filename.toUpperCase());

  cmd = cmd.replace("{kebab-stem}", toKebab(stem));
  cmd = cmd.replace("{camel-stem}", toCamel(stem));
  cmd = cmd.replace("{pascal-stem}", toPascal(stem));
  cmd = cmd.replace("{snake-stem}", toSnake(stem));
  cmd = cmd.replace("{lower-stem}", stem.toLowerCase());
  cmd = cmd.replace("{upper-stem}", stem.toUpperCase());

  cmd = cmd.replace("{n}", String(item.number));
  cmd = cmd.replace("{i}", String(item.index));

  if (cmd === template) {
    cmd = `${template} ${quotedValue}`;
  }

  return cmd;
}

function runCommands(
  items: Item[],
  opts: ReturnType<typeof parseArgs>,
): number {
  let finalCode = 0;

  for (const item of items) {
    const cmd = renderCommand(opts.command, item);

    if (opts.dryRun) {
      console.log(cmd);
      continue;
    }

    if (!opts.quiet) {
      console.error(`[${item.number}] $ ${cmd}`);
    }

    const result = spawnSync(cmd, [], { shell: true, stdio: "inherit" });
    if (result.status !== 0) {
      finalCode = result.status ?? 1;
      console.error(
        `each: command failed for item #${item.number} with exit code ${result.status}`,
      );
      if (opts.failFast) return result.status ?? 1;
    }
  }

  return finalCode;
}

async function main(): Promise<number> {
  const opts = parseArgs();

  const stdinText = await readStdin();

  const values = parseStdin(stdinText, opts.json, opts.split, opts.keepEmpty);
  const items = makeItems(values);
  return runCommands(items, opts);
}

if (isMain(import.meta.url)) {
  main().then((code) => process.exit(code));
}
