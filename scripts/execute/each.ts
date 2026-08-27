#!/usr/bin/env tsx
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { basename, extname } from "node:path";
import { isMain, readStdin } from "./utils.ts";

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

const HELP_TEXT = `Usage: each [options] <command>

Options:
  --json            Parse stdin as JSON array
  --split MODE|DELIM Split mode or custom delimiter. Built-in: line (default),
                     whitespace, blank, none. Named delimiters: tab, backspace,
                     null, newline, space, comma, colon. Any other value used as
                     literal delimiter string.
  --print           Print commands without executing
  --accept          Prompt [Y/n] before running each command
  --fail-fast       Stop on first failure
  --keep-empty      Keep empty items
  --batch           Run all items as a single command
  --batch=N         Run N items per command
  --parallel        Run all items concurrently
  --parallel=N      Run at most N items concurrently
  --quiet           Hide progress output
  --help            Show this message
  -h                Alias for --help

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
  {number}        1-based item number (alias for {n})
  {i}             0-based item number
  {index}         0-based item number (alias for {i})
  {today}         Current date YYYY-MM-DD
  {ipad}          0-based index zero-padded to total width
  {indexpad}      Alias for {ipad}
  {npad}          1-based number zero-padded to total width
  {numberpad}     Alias for {npad}`;

const SHELL_OPERATORS = new Set([
  "|",
  "&&",
  "||",
  ";",
  "&",
  ">",
  "<",
  ">>",
  "<<",
  "2>",
  "1>",
  "&1",
  "2>&1",
  "|&",
]);

export function quoteArgForShell(arg: string): string {
  if (arg === "") return "''";
  if (SHELL_OPERATORS.has(arg)) return arg;

  // If the argument is a simple safe string, no need to quote
  if (/^[a-zA-Z0-9_\-\/\.\:\+\=\@\,]+$/.test(arg)) {
    return arg;
  }

  const placeholderRegex =
    /({}|{(?:raw|filename|stem|ext|kebab|camel|pascal|snake|lower|upper|kebab-fn|camel-fn|pascal-fn|snake-fn|lower-fn|upper-fn|kebab-stem|camel-stem|pascal-stem|snake-stem|lower-stem|upper-stem|n|number|i|index|today|ipad|indexpad|npad|numberpad)})/g;

  const parts = arg.split(placeholderRegex);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) {
        return part;
      }
      if (part === "") return "";
      if (/^[a-zA-Z0-9_\-\/\.\:\+\=\@\,]+$/.test(part)) {
        return part;
      }
      return `'${part.replace(/'/g, "'\\''")}'`;
    })
    .join("");
}

export function parseArgs(): {
  command: string;
  json: boolean;
  split: string;
  print: boolean;
  accept: boolean;
  batch: false | number;
  parallel: false | number;
  failFast: boolean;
  keepEmpty: boolean;
  quiet: boolean;
} {
  const cliArgs = process.argv.slice(2);
  let command = "";
  const opts: Record<string, string | boolean | number> = {
    json: false,
    split: "line",
    print: false,
    accept: false,
    batch: false,
    parallel: false,
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
      if (!cliArgs[i + 1]) {
        console.error("each: --split requires an argument");
        process.exit(1);
      }
      opts.split = cliArgs[i + 1];
      i += 2;
      continue;
    }
    if (arg === "--print") {
      opts.print = true;
      i++;
      continue;
    }
    if (arg === "--accept") {
      opts.accept = true;
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
    if (arg === "--batch") {
      opts.batch = -1;
      i++;
      continue;
    }
    if (arg.startsWith("--batch=")) {
      const val = arg.split("=")[1];
      const n = parseInt(val, 10);
      if (isNaN(n) || n < 1) {
        console.error("each: --batch=N requires a positive integer");
        process.exit(1);
      }
      opts.batch = n;
      i++;
      continue;
    }
    if (arg === "--parallel") {
      opts.parallel = -1;
      i++;
      continue;
    }
    if (arg.startsWith("--parallel=")) {
      const val = arg.split("=")[1];
      const n = parseInt(val, 10);
      if (isNaN(n) || n < 1) {
        console.error("each: --parallel=N requires a positive integer");
        process.exit(1);
      }
      opts.parallel = n;
      i++;
      continue;
    }
    if (arg === "-h") {
      console.log(HELP_TEXT);
      process.exit(0);
    }
    if (arg === "--help") {
      console.log(HELP_TEXT);
      process.exit(0);
    }
    if (arg.startsWith("-")) {
      console.error(`each: unrecognized flag: ${arg}`);
      process.exit(1);
    }
    const cmdArgs = cliArgs.slice(i);
    if (cmdArgs.length === 1) {
      command = cmdArgs[0];
    } else if (cmdArgs.length > 1) {
      command = cmdArgs.map(quoteArgForShell).join(" ");
    }
    break;
  }

  if (!command) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  return {
    command,
    json: opts.json as boolean,
    split: opts.split as string,
    print: opts.print as boolean,
    accept: opts.accept as boolean,
    batch: opts.batch as number | false,
    parallel: opts.parallel as number | false,
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
  if (s === "") return "''";
  if (/^[a-zA-Z0-9_\-\/\.\:\+\=\@\,]+$/.test(s)) return s;
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function transformPath(s: string, fn: (s: string) => string): string {
  const idx = s.lastIndexOf("/");
  if (idx === -1) return fn(s);
  return s.slice(0, idx + 1) + fn(s.slice(idx + 1));
}

let _ttyState: string | null = null;

function ttySave(): void {
  if (_ttyState !== null) return;
  const r = spawnSync("stty", ["-F", "/dev/tty", "-g"], { encoding: "utf8" });
  if (r.status === 0 && r.stdout) _ttyState = r.stdout.trim();
}

function ttyRestore(): void {
  if (_ttyState) {
    spawnSync("stty", ["-F", "/dev/tty", _ttyState], { stdio: "pipe" });
    _ttyState = null;
  }
}

function confirm(cmd: string): boolean {
  process.stderr.write(`\n$ ${cmd}\nAccept? [Y/n] `);
  let fd: number;
  try {
    fd = fs.openSync("/dev/tty", "r+");
  } catch {
    return true;
  }
  const buf = Buffer.alloc(1);
  try {
    ttySave();
    spawnSync("stty", ["-F", "/dev/tty", "raw", "-echo"], { stdio: "pipe" });
    fs.readSync(fd, buf, 0, 1, null);
  } catch {
    ttyRestore();
    fs.closeSync(fd);
    return true;
  }
  ttyRestore();
  fs.closeSync(fd);
  process.stderr.write("\n");
  return buf[0] === 0x0a || buf[0] === 0x79 || buf[0] === 0x59;
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

export function renderCommand(
  template: string,
  item: Item,
  totalItems: number,
): string {
  const quotedValue = `'${item.value.replace(/'/g, "'\\''")}'`;
  const filename = basename(item.value);
  const stem = basename(item.value, extname(item.value));
  const ext = extname(item.value);
  const padWidth = String(totalItems).length;
  const today = new Date().toISOString().slice(0, 10);

  let cmd = template.replaceAll("{}", quotedValue);
  cmd = cmd.replace("{raw}", item.value);
  cmd = cmd.replace("{filename}", quoteIfNeeded(filename));
  cmd = cmd.replace("{stem}", quoteIfNeeded(stem));
  cmd = cmd.replace("{ext}", ext);

  cmd = cmd.replace(
    "{kebab}",
    quoteIfNeeded(transformPath(item.value, toKebab)),
  );
  cmd = cmd.replace(
    "{camel}",
    quoteIfNeeded(transformPath(item.value, toCamel)),
  );
  cmd = cmd.replace(
    "{pascal}",
    quoteIfNeeded(transformPath(item.value, toPascal)),
  );
  cmd = cmd.replace(
    "{snake}",
    quoteIfNeeded(transformPath(item.value, toSnake)),
  );
  cmd = cmd.replace(
    "{lower}",
    quoteIfNeeded(transformPath(item.value, (s) => s.toLowerCase())),
  );
  cmd = cmd.replace(
    "{upper}",
    quoteIfNeeded(transformPath(item.value, (s) => s.toUpperCase())),
  );

  cmd = cmd.replace("{kebab-fn}", quoteIfNeeded(toKebab(filename)));
  cmd = cmd.replace("{camel-fn}", quoteIfNeeded(toCamel(filename)));
  cmd = cmd.replace("{pascal-fn}", quoteIfNeeded(toPascal(filename)));
  cmd = cmd.replace("{snake-fn}", quoteIfNeeded(toSnake(filename)));
  cmd = cmd.replace("{lower-fn}", quoteIfNeeded(filename.toLowerCase()));
  cmd = cmd.replace("{upper-fn}", quoteIfNeeded(filename.toUpperCase()));

  cmd = cmd.replace("{kebab-stem}", quoteIfNeeded(toKebab(stem)));
  cmd = cmd.replace("{camel-stem}", quoteIfNeeded(toCamel(stem)));
  cmd = cmd.replace("{pascal-stem}", quoteIfNeeded(toPascal(stem)));
  cmd = cmd.replace("{snake-stem}", quoteIfNeeded(toSnake(stem)));
  cmd = cmd.replace("{lower-stem}", quoteIfNeeded(stem.toLowerCase()));
  cmd = cmd.replace("{upper-stem}", quoteIfNeeded(stem.toUpperCase()));

  cmd = cmd.replace("{n}", String(item.number));
  cmd = cmd.replace("{number}", String(item.number));
  cmd = cmd.replace("{i}", String(item.index));
  cmd = cmd.replace("{index}", String(item.index));

  cmd = cmd.replace("{today}", today);
  cmd = cmd.replace("{ipad}", String(item.index).padStart(padWidth, "0"));
  cmd = cmd.replace("{indexpad}", String(item.index).padStart(padWidth, "0"));
  cmd = cmd.replace("{npad}", String(item.number).padStart(padWidth, "0"));
  cmd = cmd.replace("{numberpad}", String(item.number).padStart(padWidth, "0"));

  if (cmd === template) {
    cmd = `${template} ${quotedValue}`;
  }

  return cmd;
}

export function renderBatchCommand(
  template: string,
  items: Item[],
  totalItems: number,
): string {
  let cmd = template;
  const padWidth = String(totalItems).length;
  const today = new Date().toISOString().slice(0, 10);
  const rp = (ph: string, fn: (i: Item) => string) => {
    cmd = cmd.replaceAll(ph, items.map(fn).join(" "));
  };
  rp("{}", (i) => `'${i.value.replace(/'/g, "'\\''")}'`);
  rp("{raw}", (i) => i.value);
  rp("{filename}", (i) => quoteIfNeeded(basename(i.value)));
  rp("{stem}", (i) => quoteIfNeeded(basename(i.value, extname(i.value))));
  rp("{ext}", (i) => extname(i.value));
  rp("{kebab}", (i) => quoteIfNeeded(transformPath(i.value, toKebab)));
  rp("{camel}", (i) => quoteIfNeeded(transformPath(i.value, toCamel)));
  rp("{pascal}", (i) => quoteIfNeeded(transformPath(i.value, toPascal)));
  rp("{snake}", (i) => quoteIfNeeded(transformPath(i.value, toSnake)));
  rp("{lower}", (i) =>
    quoteIfNeeded(transformPath(i.value, (s) => s.toLowerCase())),
  );
  rp("{upper}", (i) =>
    quoteIfNeeded(transformPath(i.value, (s) => s.toUpperCase())),
  );
  rp("{kebab-fn}", (i) => quoteIfNeeded(toKebab(basename(i.value))));
  rp("{camel-fn}", (i) => quoteIfNeeded(toCamel(basename(i.value))));
  rp("{pascal-fn}", (i) => quoteIfNeeded(toPascal(basename(i.value))));
  rp("{snake-fn}", (i) => quoteIfNeeded(toSnake(basename(i.value))));
  rp("{lower-fn}", (i) => quoteIfNeeded(basename(i.value).toLowerCase()));
  rp("{upper-fn}", (i) => quoteIfNeeded(basename(i.value).toUpperCase()));
  rp("{kebab-stem}", (i) =>
    quoteIfNeeded(toKebab(basename(i.value, extname(i.value)))),
  );
  rp("{camel-stem}", (i) =>
    quoteIfNeeded(toCamel(basename(i.value, extname(i.value)))),
  );
  rp("{pascal-stem}", (i) =>
    quoteIfNeeded(toPascal(basename(i.value, extname(i.value)))),
  );
  rp("{snake-stem}", (i) =>
    quoteIfNeeded(toSnake(basename(i.value, extname(i.value)))),
  );
  rp("{lower-stem}", (i) =>
    quoteIfNeeded(basename(i.value, extname(i.value)).toLowerCase()),
  );
  rp("{upper-stem}", (i) =>
    quoteIfNeeded(basename(i.value, extname(i.value)).toUpperCase()),
  );
  rp("{n}", (i) => String(i.number));
  rp("{i}", (i) => String(i.index));
  rp("{number}", (i) => String(i.number));
  rp("{index}", (i) => String(i.index));
  cmd = cmd.replace(/{today}/g, today);
  cmd = cmd.replace(/{ipad}|{indexpad}|{npad}|{numberpad}/g, (match) => {
    const isOneBased = match === "{npad}" || match === "{numberpad}";
    return items
      .map((i) => {
        const val = isOneBased ? i.number : i.index;
        return String(val).padStart(padWidth, "0");
      })
      .join(" ");
  });
  if (cmd === template) {
    const q = items.map((i) => `'${i.value.replace(/'/g, "'\\''")}'`).join(" ");
    cmd = `${template} ${q}`;
  }
  return cmd;
}

function runCommands(
  items: Item[],
  opts: ReturnType<typeof parseArgs>,
): number {
  let finalCode = 0;

  for (const item of items) {
    const cmd = renderCommand(opts.command, item, items.length);

    if (opts.print) {
      console.log(cmd);
      continue;
    }

    if (opts.accept && !confirm(cmd)) {
      if (opts.failFast) return 1;
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

function runBatchCommands(
  items: Item[],
  opts: ReturnType<typeof parseArgs>,
): number {
  if (items.length === 0) return 0;
  const batchSize =
    typeof opts.batch === "number" && opts.batch > 0
      ? opts.batch
      : items.length;
  let finalCode = 0;
  for (let start = 0; start < items.length; start += batchSize) {
    const chunk = items.slice(start, start + batchSize);
    const cmd = renderBatchCommand(opts.command, chunk, items.length);
    if (opts.print) {
      console.log(cmd);
      continue;
    }
    if (opts.accept && !confirm(cmd)) {
      if (opts.failFast) return 1;
      continue;
    }
    if (!opts.quiet)
      console.error(`[${start + 1}-${start + chunk.length}] $ ${cmd}`);
    const result = spawnSync(cmd, [], { shell: true, stdio: "inherit" });
    if (result.status !== 0) {
      finalCode = result.status ?? 1;
      console.error(
        `each: command failed for items #${start + 1}-${start + chunk.length} with exit code ${result.status}`,
      );
      if (opts.failFast) return result.status ?? 1;
    }
  }
  return finalCode;
}

async function runParallelCommands(
  items: Item[],
  opts: ReturnType<typeof parseArgs>,
): Promise<number> {
  const maxConcurrency =
    typeof opts.parallel === "number" && opts.parallel > 0
      ? opts.parallel
      : items.length;

  if (opts.accept && !opts.print) {
    items = items.filter((item) => {
      const cmd = renderCommand(opts.command, item, items.length);
      return confirm(cmd);
    });
  }

  let finalCode = 0;
  let aborted = false;
  const children: import("node:child_process").ChildProcess[] = [];

  async function runOne(item: Item): Promise<number> {
    if (aborted) return 0;
    const cmd = renderCommand(opts.command, item, items.length);
    if (opts.print) {
      console.log(cmd);
      return 0;
    }
    if (!opts.quiet) {
      console.error(`[${item.number}] $ ${cmd}`);
    }
    const child = spawn(cmd, [], { shell: true, stdio: "inherit" });
    children[item.index] = child;
    const code: number = await new Promise((resolve) =>
      child.on("close", resolve),
    );
    if (code !== 0) {
      console.error(
        `each: command failed for item #${item.number} with exit code ${code}`,
      );
      if (opts.failFast) {
        aborted = true;
        for (const c of children) if (c && !c.killed) c.kill();
      }
    }
    return code;
  }

  const errors: number[] = [];
  let idx = 0;
  const worker = async () => {
    while (idx < items.length && !aborted) {
      const i = idx++;
      const code = await runOne(items[i]);
      if (code !== 0) {
        errors.push(code);
        if (opts.failFast) break;
      }
    }
  };

  const poolSize = Math.min(maxConcurrency, items.length);
  const workers = Array.from({ length: poolSize }, () => worker());
  await Promise.allSettled(workers);

  return errors.length > 0 ? errors[0] : 0;
}

async function main(): Promise<number> {
  const opts = parseArgs();

  if (opts.accept) {
    process.on("SIGINT", () => {
      ttyRestore();
      process.exit(130);
    });
    process.on("SIGTERM", () => {
      ttyRestore();
      process.exit(143);
    });
  }

  const stdinText = await readStdin();

  const values = parseStdin(stdinText, opts.json, opts.split, opts.keepEmpty);
  const items = makeItems(values);
  if (items.length === 0) return 0;
  if (opts.batch !== false) return runBatchCommands(items, opts);
  if (opts.parallel !== false) return runParallelCommands(items, opts);
  return runCommands(items, opts);
}

if (isMain(import.meta.url)) {
  main().then((code) => process.exit(code));
}
