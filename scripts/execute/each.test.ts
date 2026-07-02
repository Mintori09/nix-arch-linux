import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseStdin,
  splitByBlankLines,
  makeItems,
  Item,
  renderCommand,
  parseArgs,
} from "./each.ts";

// --- parseArgs (--print) ---

it("parseArgs --print returns print=true", () => {
  const oldArgv = process.argv;
  process.argv = ["node", "each.ts", "--print", "echo"];
  try {
    const opts = parseArgs();
    assert.equal(opts.print, true);
  } finally {
    process.argv = oldArgv;
  }
});

it("parseArgs --split accepts custom delimiter", () => {
  const oldArgv = process.argv;
  process.argv = ["node", "each.ts", "--split", "|", "echo"];
  try {
    const opts = parseArgs();
    assert.equal(opts.split, "|");
  } finally {
    process.argv = oldArgv;
  }
});

it("parseArgs --split= form works", () => {
  const oldArgv = process.argv;
  process.argv = ["node", "each.ts", "--split=,", "echo"];
  try {
    const opts = parseArgs();
    assert.equal(opts.split, ",");
  } finally {
    process.argv = oldArgv;
  }
});

it("parseArgs --quiet and --fail-fast flags", () => {
  const oldArgv = process.argv;
  process.argv = ["node", "each.ts", "--quiet", "--fail-fast", "echo"];
  try {
    const opts = parseArgs();
    assert.equal(opts.quiet, true);
    assert.equal(opts.failFast, true);
  } finally {
    process.argv = oldArgv;
  }
});

it("parseArgs --keep-empty flag", () => {
  const oldArgv = process.argv;
  process.argv = ["node", "each.ts", "--keep-empty", "echo"];
  try {
    const opts = parseArgs();
    assert.equal(opts.keepEmpty, true);
  } finally {
    process.argv = oldArgv;
  }
});

// --- parseStdin ---

it("parseStdin with custom delimiter splits correctly", () => {
  const result = parseStdin("a|b|c", false, "|", false);
  assert.deepEqual(result, ["a", "b", "c"]);
});

it("parseStdin with named delimiter (comma)", () => {
  const result = parseStdin("x,y,z", false, "comma", false);
  assert.deepEqual(result, ["x", "y", "z"]);
});

it("parseStdin with named delimiter (tab)", () => {
  const result = parseStdin("a\tb\tc", false, "tab", false);
  assert.deepEqual(result, ["a", "b", "c"]);
});

it("parseStdin with named delimiter (backspace)", () => {
  const result = parseStdin("a\bb\bc", false, "backspace", false);
  assert.deepEqual(result, ["a", "b", "c"]);
});

it("parseStdin with named delimiter (null)", () => {
  const result = parseStdin("a\0b\0c", false, "null", false);
  assert.deepEqual(result, ["a", "b", "c"]);
});

it("parseStdin with named delimiter (colon)", () => {
  const result = parseStdin("a:b:c", false, "colon", false);
  assert.deepEqual(result, ["a", "b", "c"]);
});

it("parseStdin with named delimiter (newline)", () => {
  const result = parseStdin("a\nb\nc", false, "newline", false);
  assert.deepEqual(result, ["a", "b", "c"]);
});

it("parseStdin with line mode still works (regression)", () => {
  const result = parseStdin("a\nb\nc", false, "line", false);
  assert.deepEqual(result, ["a", "b", "c"]);
});

it("parseStdin with whitespace mode still works (regression)", () => {
  const result = parseStdin("a b  c   d", false, "whitespace", false);
  assert.deepEqual(result, ["a", "b", "c", "d"]);
});

it("parseStdin with blank mode still works (regression)", () => {
  const result = parseStdin("a\n\nb\n\nc", false, "blank", false);
  assert.deepEqual(result, ["a", "b", "c"]);
});

it("parseStdin with none mode still works (regression)", () => {
  const result = parseStdin("a\nb\nc", false, "none", false);
  assert.deepEqual(result, ["a\nb\nc"]);
});

it("parseStdin with JSON mode still works (regression)", () => {
  const result = parseStdin('["a", "b", "c"]', true, "line", false);
  assert.deepEqual(result, ["a", "b", "c"]);
});

it("parseStdin keepEmpty with custom delimiter", () => {
  const result = parseStdin("a||c", false, "|", true);
  assert.deepEqual(result, ["a", "", "c"]);
});

it("parseStdin custom delimiter multi-character", () => {
  const result = parseStdin("a::b::c", false, "::", false);
  assert.deepEqual(result, ["a", "b", "c"]);
});

// --- splitByBlankLines ---

it("splitByBlankLines splits correctly", () => {
  const result = splitByBlankLines("a\n\nb\n\nc", false);
  assert.deepEqual(result, ["a", "b", "c"]);
});

it("splitByBlankLines keeps empty when requested", () => {
  const result = splitByBlankLines("a\n\n\nb", true);
  assert.deepEqual(result, ["a", "", "b"]);
});

// --- makeItems ---

it("makeItems creates Items with correct number and index", () => {
  const items = makeItems(["a", "b", "c"]);
  assert.equal(items.length, 3);
  assert.equal(items[0].number, 1);
  assert.equal(items[0].index, 0);
  assert.equal(items[1].number, 2);
  assert.equal(items[1].index, 1);
  assert.equal(items[2].number, 3);
  assert.equal(items[2].index, 2);
});

it("makeItems preserves values", () => {
  const items = makeItems(["hello", "world"]);
  assert.equal(items[0].value, "hello");
  assert.equal(items[1].value, "world");
});

// --- renderCommand ---

it("renderCommand replaces {} with shell-quoted value", () => {
  const item = new Item("hello world", 1);
  const result = renderCommand("echo {}", item);
  assert.equal(result, "echo 'hello world'");
});

it("renderCommand replaces {n} and {i} placeholders", () => {
  const item = new Item("foo", 3);
  const result = renderCommand("echo {n} {i}", item);
  assert.equal(result, "echo 3 2");
});

it("renderCommand replaces {raw} with unquoted value", () => {
  const item = new Item("foo bar", 1);
  const result = renderCommand("echo {raw}", item);
  assert.equal(result, "echo foo bar");
});

it("renderCommand replaces {filename}", () => {
  const item = new Item("/path/to/file.txt", 1);
  const result = renderCommand("echo {filename}", item);
  assert.equal(result, "echo file.txt");
});

it("renderCommand replaces {stem}", () => {
  const item = new Item("archive.tar.gz", 1);
  const result = renderCommand("echo {stem}", item);
  assert.equal(result, "echo archive.tar");
});

it("renderCommand replaces {ext}", () => {
  const item = new Item("archive.tar.gz", 1);
  const result = renderCommand("echo {ext}", item);
  assert.equal(result, "echo .gz");
});

it("renderCommand case transforms", () => {
  const item = new Item("hello-world", 1);
  const r = renderCommand(
    "{kebab} {camel} {pascal} {snake} {lower} {upper}",
    item,
  );
  assert.equal(
    r,
    "hello-world helloWorld HelloWorld hello_world hello-world HELLO-WORLD",
  );
});

// --- batch mode ---

it("batch --print renders all items in one command", () => {
  const oldArgv = process.argv;
  process.argv = ["node", "each.ts", "--batch", "--print", "echo"];
  try {
    const opts = parseArgs();
    assert.equal(opts.batch, -1);
    assert.equal(opts.print, true);
  } finally {
    process.argv = oldArgv;
  }
});

it("batch=N --print renders N items per command", () => {
  const oldArgv = process.argv;
  process.argv = ["node", "each.ts", "--batch=2", "--print", "echo"];
  try {
    const opts = parseArgs();
    assert.equal(opts.batch, 2);
  } finally {
    process.argv = oldArgv;
  }
});
