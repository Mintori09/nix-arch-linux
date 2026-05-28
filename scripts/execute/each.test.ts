import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Item, makeItems, parseStdin, renderCommand, splitByBlankLines, stringifyJsonItem } from "./each.ts";

it("stringifyJsonItem - returns string as-is", () => {
  assert.strictEqual(stringifyJsonItem("hello"), "hello");
});

it("stringifyJsonItem - JSON-stringifies objects", () => {
  assert.strictEqual(stringifyJsonItem({ a: 1 }), '{"a":1}');
});

it("stringifyJsonItem - JSON-stringifies numbers", () => {
  assert.strictEqual(stringifyJsonItem(42), "42");
});

it("splitByBlankLines - splits text into blocks by blank lines", () => {
  assert.deepEqual(
    splitByBlankLines("line1\nline2\n\nline3\nline4", false),
    ["line1\nline2", "line3\nline4"],
  );
});

it("splitByBlankLines - keeps empty blocks with keepEmpty", () => {
  assert.deepEqual(
    splitByBlankLines("a\n\n\nb", true),
    ["a", "", "b"],
  );
});

it("parseStdin - splits by lines by default", () => {
  assert.deepEqual(
    parseStdin("a\nb\nc", false, "line", false),
    ["a", "b", "c"],
  );
});

it("parseStdin - splits by whitespace", () => {
  assert.deepEqual(
    parseStdin("a b   c\td", false, "whitespace", false),
    ["a", "b", "c", "d"],
  );
});

it("parseStdin - none mode returns whole text as single item", () => {
  assert.deepEqual(
    parseStdin("hello world", false, "none", false),
    ["hello world"],
  );
});

it("parseStdin - splits by blank lines", () => {
  assert.deepEqual(
    parseStdin("block1\nline2\n\nblock3", false, "blank", false),
    ["block1\nline2", "block3"],
  );
});

it("parseStdin - parses JSON array of strings", () => {
  assert.deepEqual(
    parseStdin('["a", "b", "c"]', true, "line", false),
    ["a", "b", "c"],
  );
});

it("parseStdin - parses JSON array of objects", () => {
  assert.deepEqual(
    parseStdin('[{"x":1}, {"y":2}]', true, "line", false),
    ['{"x":1}', '{"y":2}'],
  );
});

it("parseStdin - strips empty lines by default", () => {
  assert.deepEqual(
    parseStdin("a\n\n\nb", false, "line", false),
    ["a", "b"],
  );
});

it("parseStdin - keeps empty lines with keepEmpty", () => {
  assert.deepEqual(
    parseStdin("a\n\n\nb", false, "line", true),
    ["a", "", "", "b"],
  );
});

it("renderCommand - replaces {} with shell-quoted value", () => {
  const item = new Item("hello", 1);
  assert.strictEqual(renderCommand("echo {}", item), "echo 'hello'");
});

it("renderCommand - replaces {raw} with raw value", () => {
  const item = new Item("hello world", 1);
  assert.strictEqual(renderCommand("echo {raw}", item), "echo hello world");
});

it("renderCommand - replaces {n} with 1-based number", () => {
  const item = new Item("test", 3);
  assert.strictEqual(renderCommand("echo {n}", item), "echo 3");
});

it("renderCommand - replaces {i} with 0-based index", () => {
  const item = new Item("test", 3);
  assert.strictEqual(renderCommand("echo {i}", item), "echo 2");
});

it("renderCommand - escapes single quotes in value", () => {
  const item = new Item("it's", 1);
  assert.strictEqual(renderCommand("echo {}", item), "echo 'it'\\''s'");
});

it("renderCommand - appends quoted value when no placeholder", () => {
  const item = new Item("test", 1);
  assert.strictEqual(renderCommand("cat", item), "cat 'test'");
});

it("makeItems - creates Item array with correct number/index", () => {
  const items = makeItems(["a", "b", "c"]);
  assert.strictEqual(items.length, 3);
  assert.strictEqual(items[0]!.number, 1);
  assert.strictEqual(items[0]!.index, 0);
  assert.strictEqual(items[0]!.value, "a");
  assert.strictEqual(items[2]!.number, 3);
  assert.strictEqual(items[2]!.index, 2);
  assert.strictEqual(items[2]!.value, "c");
});
