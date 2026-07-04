import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  applyRandomSelection,
  buildContentBlocks,
  decodeSeparatorValue,
  formatDisplayPath,
  parseArgs,
  shouldQuotePath,
  validateParsedArgs,
  mergeUniquePaths,
} from "./copy-files.ts";

it("shouldQuotePath - returns false for simple shell-safe paths", () => {
  assert.strictEqual(shouldQuotePath("/tmp/plain-file.txt"), false);
});

it("shouldQuotePath - returns true for paths containing whitespace", () => {
  assert.strictEqual(shouldQuotePath("/tmp/two words.txt"), true);
});

it("shouldQuotePath - returns true for paths containing shell-sensitive characters", () => {
  assert.strictEqual(shouldQuotePath("/tmp/[2] Obsidian/report.md"), true);
});

it("formatDisplayPath - auto-wraps full paths with whitespace in double quotes", () => {
  assert.strictEqual(
    formatDisplayPath("/tmp/two words.txt"),
    '"/tmp/two words.txt"',
  );
});

it("formatDisplayPath - auto-wraps full paths with shell-sensitive characters in double quotes", () => {
  assert.strictEqual(
    formatDisplayPath("/tmp/[2] Obsidian/report.md"),
    '"/tmp/[2] Obsidian/report.md"',
  );
});

it("formatDisplayPath - leaves shell-safe paths unquoted by default", () => {
  assert.strictEqual(
    formatDisplayPath("/tmp/plain-file.txt"),
    "/tmp/plain-file.txt",
  );
});

it("formatDisplayPath - always quotes when the explicit quote option is enabled", () => {
  assert.strictEqual(
    formatDisplayPath("/tmp/plain-file.txt", { alwaysQuote: true }),
    '"/tmp/plain-file.txt"',
  );
});

it("formatDisplayPath - applies the same auto-quote rule in basename mode", () => {
  assert.strictEqual(
    formatDisplayPath("deep research report.md"),
    '"deep research report.md"',
  );
});

it("formatDisplayPath - renders home-relative paths without quoting the tilde", () => {
  const filePath = join(homedir(), "projects/demo.txt");
  assert.strictEqual(
    formatDisplayPath(filePath, { homeRelative: true }),
    "~/projects/demo.txt",
  );
});

it("formatDisplayPath - escapes shell-unsafe characters in home-relative paths", () => {
  const filePath = join(homedir(), "My Files", "[draft] report.md");
  assert.strictEqual(
    formatDisplayPath(filePath, { homeRelative: true }),
    "~/My\\ Files/\\[draft\\]\\ report.md",
  );
});

it("formatDisplayPath - renders the home directory itself as a bare tilde", () => {
  assert.strictEqual(formatDisplayPath(homedir(), { homeRelative: true }), "~");
});

it("formatDisplayPath - keeps non-home paths absolute in home-relative mode", () => {
  assert.strictEqual(
    formatDisplayPath("/tmp/plain-file.txt", { homeRelative: true }),
    "/tmp/plain-file.txt",
  );
});

it("parseArgs - parses repeated type selectors, recursion, and home-relative output", () => {
  assert.deepEqual(
    parseArgs([
      "--type",
      "subtitles",
      "--type",
      "images",
      "--recursive",
      "--home-relative",
      "movie.mkv",
    ]),
    {
      copyContent: false,
      contentPathMode: "none",
      dryRun: false,
      files: ["movie.mkv"],
      homeRelative: true,
      randomCount: null,
      recursive: true,
      selectors: ["subtitles", "images"],
      gitUntracked: false,
      separator: " ",
      useBasename: false,
      useQuotes: false,
    },
  );
});

it("parseArgs - keeps explicit files and all-selector together", () => {
  assert.deepEqual(parseArgs(["--all", "a.txt", "b.txt"]).selectors, ["all"]);
  assert.deepEqual(parseArgs(["--all", "a.txt", "b.txt"]).files, [
    "a.txt",
    "b.txt",
  ]);
});

it("parseArgs - parses random count after type selector flags", () => {
  assert.strictEqual(
    parseArgs(["--type", "text", "--random", "3"]).randomCount,
    3,
  );
});

it("parseArgs - rejects invalid random count", () => {
  assert.throws(
    () => parseArgs(["--random", "0"]),
    Error,
    "Invalid number for --random flag: 0",
  );
});

it("parseArgs - rejects missing random count", () => {
  assert.throws(
    () => parseArgs(["--random"]),
    Error,
    "Usage: --random requires a number argument (e.g., --random 3)",
  );
});

it("parseArgs - rejects invalid type values with valid groups listed", () => {
  assert.throws(
    () => parseArgs(["--type", "unknown"]),
    Error,
    "Invalid value for --type: unknown. Valid groups: images, subtitles, text",
  );
});

it("parseArgs - rejects missing type value", () => {
  assert.throws(
    () => parseArgs(["--type"]),
    Error,
    "Usage: --type requires a value (images, subtitles, or text)",
  );
});

it("parseArgs - parses newline separator from long flag", () => {
  assert.strictEqual(parseArgs(["--separator", "\\n"]).separator, "\n");
});

it("parseArgs - rejects empty separator", () => {
  assert.throws(
    () => parseArgs(["--separator", ""]),
    Error,
    "--separator value cannot be empty",
  );
});

it("parseArgs - rejects missing separator value", () => {
  assert.throws(
    () => parseArgs(["--separator"]),
    Error,
    'Usage: --separator requires a value (e.g., --separator "\\n")',
  );
});

it("parseArgs - enables content mode from long flag", () => {
  assert.strictEqual(parseArgs(["--content"]).copyContent, true);
});

it("parseArgs - enables basename-only mode from long flag", () => {
  assert.strictEqual(parseArgs(["--name-only"]).useBasename, true);
});

it("parseArgs - enables quote mode from long flag", () => {
  assert.strictEqual(parseArgs(["--quote"]).useQuotes, true);
});

it("parseArgs - rejects legacy comma separator flag with migration guidance", () => {
  assert.throws(
    () => parseArgs(["-c"]),
    Error,
    'Flag -c was removed. Use --separator "," instead.',
  );
});

it("parseArgs - rejects legacy tab separator flag with migration guidance", () => {
  assert.throws(
    () => parseArgs(["-t"]),
    Error,
    'Flag -t was removed. Use --separator "\\t" instead.',
  );
});

it("parseArgs - rejects legacy line separator flag with migration guidance", () => {
  assert.throws(
    () => parseArgs(["-l"]),
    Error,
    'Flag -l was removed. Use --separator "\\n" instead.',
  );
});

it("parseArgs - rejects removed selector flags with migration guidance", () => {
  assert.throws(
    () => parseArgs(["--images"]),
    Error,
    "Flag --images was removed. Use --type images instead.",
  );
  assert.throws(
    () => parseArgs(["--subtitles"]),
    Error,
    "Flag --subtitles was removed. Use --type subtitles instead.",
  );
  assert.throws(
    () => parseArgs(["--text"]),
    Error,
    "Flag --text was removed. Use --type text instead.",
  );
});

it("parseArgs - rejects removed short flags with migration guidance", () => {
  assert.throws(
    () => parseArgs(["-s", "\\t"]),
    Error,
    "Flag -s was removed. Use --separator instead.",
  );
  assert.throws(
    () => parseArgs(["-C"]),
    Error,
    "Flag -C was removed. Use --content instead.",
  );
  assert.throws(
    () => parseArgs(["-R"]),
    Error,
    "Flag -R was removed. Use --recursive instead.",
  );
  assert.throws(
    () => parseArgs(["-H"]),
    Error,
    "Flag -H was removed. Use --home-relative instead.",
  );
  assert.throws(
    () => parseArgs(["-r", "3"]),
    Error,
    "Flag -r was removed. Use --random instead.",
  );
  assert.throws(
    () => parseArgs(["-b"]),
    Error,
    "Flag -b was removed. Use --name-only instead.",
  );
  assert.throws(
    () => parseArgs(["-q"]),
    Error,
    "Flag -q was removed. Use --quote instead.",
  );
});

it("decodeSeparatorValue - decodes supported escape sequences", () => {
  assert.strictEqual(decodeSeparatorValue("\\n\\t\\r\\\\"), "\n\t\r\\");
});

it("decodeSeparatorValue - leaves unknown escape sequences literal", () => {
  assert.strictEqual(decodeSeparatorValue("\\x\\z"), "\\x\\z");
});

it("buildContentBlocks - formats one file as full path, blank line, and content", () => {
  assert.strictEqual(
    buildContentBlocks(
      [{ resolvedPath: "/tmp/a.txt", fileContent: "alpha\nbeta" }],
      "fullpath",
    ),
    "/tmp/a.txt\n\nalpha\nbeta",
  );
});

it("buildContentBlocks - joins multiple files with blank lines between blocks in order", () => {
  assert.strictEqual(
    buildContentBlocks(
      [
        { resolvedPath: "/tmp/a.txt", fileContent: "alpha" },
        { resolvedPath: "/tmp/b.txt", fileContent: "beta" },
      ],
      "fullpath",
    ),
    "/tmp/a.txt\n\nalpha\n\n/tmp/b.txt\n\nbeta",
  );
});

it("buildContentBlocks - returns just content when path mode is none", () => {
  assert.strictEqual(
    buildContentBlocks(
      [
        { resolvedPath: "/tmp/a.txt", fileContent: "alpha" },
        { resolvedPath: "/tmp/b.txt", fileContent: "beta" },
      ],
      "none",
    ),
    "alpha\n\nbeta",
  );
});

it("validateParsedArgs - allows home-relative output on its own", () => {
  validateParsedArgs({
    copyContent: false,
    files: [],
    homeRelative: true,
    randomCount: null,
    recursive: false,
    selectors: [],
    contentPathMode: "none",
    dryRun: false,
    gitUntracked: false,
    separator: " ",
    useBasename: false,
    useQuotes: false,
  });
});

it("validateParsedArgs - rejects home-relative with quote mode", () => {
  assert.throws(
    () =>
      validateParsedArgs({
        copyContent: false,
        files: [],
        homeRelative: true,
        randomCount: null,
        recursive: false,
        selectors: [],
        contentPathMode: "none",
        dryRun: false,
        gitUntracked: false,
        separator: " ",
        useBasename: false,
        useQuotes: true,
      }),
    Error,
    "--home-relative cannot be combined with --content, --name-only, or --quote",
  );
});

it("validateParsedArgs - rejects home-relative with basename mode", () => {
  assert.throws(
    () =>
      validateParsedArgs({
        copyContent: false,
        files: [],
        homeRelative: true,
        randomCount: null,
        recursive: false,
        selectors: [],
        contentPathMode: "none",
        dryRun: false,
        gitUntracked: false,
        separator: " ",
        useBasename: true,
        useQuotes: false,
      }),
    Error,
    "--home-relative cannot be combined with --content, --name-only, or --quote",
  );
});

it("validateParsedArgs - rejects home-relative with content mode", () => {
  assert.throws(
    () =>
      validateParsedArgs({
        copyContent: true,
        files: [],
        homeRelative: true,
        randomCount: null,
        recursive: false,
        selectors: [],
        contentPathMode: "none",
        dryRun: false,
        gitUntracked: false,
        separator: " ",
        useBasename: false,
        useQuotes: false,
      }),
    Error,
    "--home-relative cannot be combined with --content, --name-only, or --quote",
  );
});

it("mergeUniquePaths - keeps the first occurrence order across explicit and selector files", () => {
  assert.deepEqual(
    mergeUniquePaths(
      ["./manual-a.srt", "./manual-b.srt"],
      ["./manual-b.srt", "./found-c.srt", "./manual-a.srt"],
    ),
    ["./manual-a.srt", "./manual-b.srt", "./found-c.srt"],
  );
});

it("applyRandomSelection - applies random slicing after shuffle", () => {
  const result = applyRandomSelection(["a", "b", "c", "d"], 2, (items) =>
    [...items].reverse(),
  );

  assert.deepEqual(result, ["d", "c"]);
});

it("applyRandomSelection - returns original items when random mode is disabled", () => {
  assert.deepEqual(applyRandomSelection(["a", "b"], null), ["a", "b"]);
});
