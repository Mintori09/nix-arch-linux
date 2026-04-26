import { describe, expect, test } from "bun:test";

import { formatDisplayPath, shouldQuotePath } from "./copy-files";

describe("shouldQuotePath", () => {
  test("returns false for simple shell-safe paths", () => {
    expect(shouldQuotePath("/tmp/plain-file.txt")).toBe(false);
  });

  test("returns true for paths containing whitespace", () => {
    expect(shouldQuotePath("/tmp/two words.txt")).toBe(true);
  });

  test("returns true for paths containing shell-sensitive characters", () => {
    expect(shouldQuotePath("/tmp/[2] Obsidian/report.md")).toBe(true);
  });
});

describe("formatDisplayPath", () => {
  test("auto-wraps full paths with whitespace in double quotes", () => {
    expect(formatDisplayPath("/tmp/two words.txt")).toBe('"/tmp/two words.txt"');
  });

  test("auto-wraps full paths with shell-sensitive characters in double quotes", () => {
    expect(formatDisplayPath("/tmp/[2] Obsidian/report.md")).toBe(
      '"/tmp/[2] Obsidian/report.md"',
    );
  });

  test("leaves shell-safe paths unquoted by default", () => {
    expect(formatDisplayPath("/tmp/plain-file.txt")).toBe(
      "/tmp/plain-file.txt",
    );
  });

  test("always quotes when the explicit quote option is enabled", () => {
    expect(formatDisplayPath("/tmp/plain-file.txt", { alwaysQuote: true })).toBe(
      '"/tmp/plain-file.txt"',
    );
  });

  test("applies the same auto-quote rule in basename mode", () => {
    expect(formatDisplayPath("deep research report.md")).toBe(
      '"deep research report.md"',
    );
  });
});
