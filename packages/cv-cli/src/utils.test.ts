import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shortStderr, shellEscape, formatCommand } from "./core/command.ts";
import { calculateViewportSize } from "./core/chromium.ts";

describe("shortStderr", () => {
  it("returns '(empty stderr)' for empty", () =>
    assert.strictEqual(shortStderr(""), "(empty stderr)"));
  it("trims whitespace", () => assert.strictEqual(shortStderr("  hi  "), "hi"));
  it("truncates to maxLines", () => {
    const input = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join(
      "\n",
    );
    assert.strictEqual(shortStderr(input, 3, 1000).split("\n").length, 3);
  });
  it("truncates to maxChars", () => {
    const result = shortStderr("a".repeat(1000), 10, 10);
    assert.ok(result.length <= 13);
    assert.ok(result.endsWith("..."));
  });
});

describe("calculateViewportSize", () => {
  it("adds 32px height padding", () => {
    const r = calculateViewportSize({ width: 800, height: 600 });
    assert.strictEqual(r.width, 800);
    assert.strictEqual(r.height, 632);
  });
  it("ceil()s fractional", () => {
    const r = calculateViewportSize({ width: 800.4, height: 600.2 });
    assert.strictEqual(r.width, 801);
    assert.strictEqual(r.height, 633);
  });
  it("minimum 1px width, height floors at 32+1=33", () => {
    const r = calculateViewportSize({ width: 0, height: 0 });
    assert.strictEqual(r.width, 1);
    assert.strictEqual(r.height, 32);
  });
  it("throws on NaN", () =>
    assert.throws(() => calculateViewportSize({ width: NaN, height: 600 })));
  it("throws on Infinity", () =>
    assert.throws(() =>
      calculateViewportSize({ width: Infinity, height: 600 }),
    ));
});

describe("shellEscape", () => {
  it("safe strings pass through", () => {
    assert.strictEqual(shellEscape("hello"), "hello");
    assert.strictEqual(shellEscape("./path/file"), "./path/file");
  });
  it("unsafe strings get quoted", () => {
    assert.strictEqual(shellEscape("hello world"), "'hello world'");
  });
  it("escapes single quotes", () => {
    assert.strictEqual(shellEscape("it's"), "'it'\\''s'");
  });
});

describe("formatCommand", () => {
  it("joins escaped parts", () =>
    assert.strictEqual(
      formatCommand(["echo", "hello world"]),
      "echo 'hello world'",
    ));
});
