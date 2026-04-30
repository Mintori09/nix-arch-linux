import { describe, expect, test } from "bun:test";
import { homedir } from "os";
import { join } from "path";

import {
  applyRandomSelection,
  formatDisplayPath,
  parseArgs,
  shouldQuotePath,
  validateParsedArgs,
  mergeUniquePaths,
} from "./copy-files";

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

  test("renders home-relative paths without quoting the tilde", () => {
    const filePath = join(homedir(), "projects/demo.txt");
    expect(formatDisplayPath(filePath, { homeRelative: true })).toBe(
      "~/projects/demo.txt",
    );
  });

  test("escapes shell-unsafe characters in home-relative paths", () => {
    const filePath = join(homedir(), "My Files", "[draft] report.md");
    expect(formatDisplayPath(filePath, { homeRelative: true })).toBe(
      "~/My\\ Files/\\[draft\\]\\ report.md",
    );
  });

  test("renders the home directory itself as a bare tilde", () => {
    expect(formatDisplayPath(homedir(), { homeRelative: true })).toBe("~");
  });

  test("keeps non-home paths absolute in home-relative mode", () => {
    expect(formatDisplayPath("/tmp/plain-file.txt", { homeRelative: true })).toBe(
      "/tmp/plain-file.txt",
    );
  });
});

describe("parseArgs", () => {
  test("parses selectors, recursion, and home-relative output", () => {
    expect(
      parseArgs(["--subtitles", "--images", "-R", "-H", "movie.mkv"]),
    ).toEqual({
      copyContent: false,
      files: ["movie.mkv"],
      homeRelative: true,
      randomCount: null,
      recursive: true,
      selectors: ["subtitles", "images"],
      separator: " ",
      useBasename: false,
      useQuotes: false,
    });
  });

  test("keeps explicit files and all-selector together", () => {
    expect(parseArgs(["--all", "a.txt", "b.txt"]).selectors).toEqual(["all"]);
    expect(parseArgs(["--all", "a.txt", "b.txt"]).files).toEqual([
      "a.txt",
      "b.txt",
    ]);
  });

  test("parses random count after selector flags", () => {
    expect(parseArgs(["--text", "-r", "3"]).randomCount).toBe(3);
  });

  test("rejects invalid random count", () => {
    expect(() => parseArgs(["-r", "0"])).toThrow(
      "Invalid number for -r flag: 0",
    );
  });
});

describe("validateParsedArgs", () => {
  test("allows home-relative output on its own", () => {
    expect(() =>
      validateParsedArgs({
        copyContent: false,
        files: [],
        homeRelative: true,
        randomCount: null,
        recursive: false,
        selectors: [],
        separator: " ",
        useBasename: false,
        useQuotes: false,
      }),
    ).not.toThrow();
  });

  test("rejects home-relative with quote mode", () => {
    expect(() =>
      validateParsedArgs({
        copyContent: false,
        files: [],
        homeRelative: true,
        randomCount: null,
        recursive: false,
        selectors: [],
        separator: " ",
        useBasename: false,
        useQuotes: true,
      }),
    ).toThrow("--home-relative cannot be combined with -C, -b, or -q");
  });

  test("rejects home-relative with basename mode", () => {
    expect(() =>
      validateParsedArgs({
        copyContent: false,
        files: [],
        homeRelative: true,
        randomCount: null,
        recursive: false,
        selectors: [],
        separator: " ",
        useBasename: true,
        useQuotes: false,
      }),
    ).toThrow("--home-relative cannot be combined with -C, -b, or -q");
  });

  test("rejects home-relative with content mode", () => {
    expect(() =>
      validateParsedArgs({
        copyContent: true,
        files: [],
        homeRelative: true,
        randomCount: null,
        recursive: false,
        selectors: [],
        separator: " ",
        useBasename: false,
        useQuotes: false,
      }),
    ).toThrow("--home-relative cannot be combined with -C, -b, or -q");
  });
});

describe("mergeUniquePaths", () => {
  test("keeps the first occurrence order across explicit and selector files", () => {
    expect(
      mergeUniquePaths(
        ["./manual-a.srt", "./manual-b.srt"],
        ["./manual-b.srt", "./found-c.srt", "./manual-a.srt"],
      ),
    ).toEqual(["./manual-a.srt", "./manual-b.srt", "./found-c.srt"]);
  });
});

describe("applyRandomSelection", () => {
  test("applies random slicing after shuffle", () => {
    const result = applyRandomSelection(
      ["a", "b", "c", "d"],
      2,
      (items) => [...items].reverse(),
    );

    expect(result).toEqual(["d", "c"]);
  });

  test("returns original items when random mode is disabled", () => {
    expect(applyRandomSelection(["a", "b"], null)).toEqual(["a", "b"]);
  });
});
