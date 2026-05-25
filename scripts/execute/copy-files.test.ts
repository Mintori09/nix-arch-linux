import { assertEquals, assertStrictEq, assertThrows } from "jsr:@std/assert";
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

Deno.test("shouldQuotePath - returns false for simple shell-safe paths", () => {
  assertStrictEq(shouldQuotePath("/tmp/plain-file.txt"), false);
});

Deno.test("shouldQuotePath - returns true for paths containing whitespace", () => {
  assertStrictEq(shouldQuotePath("/tmp/two words.txt"), true);
});

Deno.test("shouldQuotePath - returns true for paths containing shell-sensitive characters", () => {
  assertStrictEq(shouldQuotePath("/tmp/[2] Obsidian/report.md"), true);
});

Deno.test("formatDisplayPath - auto-wraps full paths with whitespace in double quotes", () => {
  assertStrictEq(formatDisplayPath("/tmp/two words.txt"), '"/tmp/two words.txt"');
});

Deno.test("formatDisplayPath - auto-wraps full paths with shell-sensitive characters in double quotes", () => {
  assertStrictEq(formatDisplayPath("/tmp/[2] Obsidian/report.md"), '"/tmp/[2] Obsidian/report.md"');
});

Deno.test("formatDisplayPath - leaves shell-safe paths unquoted by default", () => {
  assertStrictEq(formatDisplayPath("/tmp/plain-file.txt"), "/tmp/plain-file.txt");
});

Deno.test("formatDisplayPath - always quotes when the explicit quote option is enabled", () => {
  assertStrictEq(formatDisplayPath("/tmp/plain-file.txt", { alwaysQuote: true }), '"/tmp/plain-file.txt"');
});

Deno.test("formatDisplayPath - applies the same auto-quote rule in basename mode", () => {
  assertStrictEq(formatDisplayPath("deep research report.md"), '"deep research report.md"');
});

Deno.test("formatDisplayPath - renders home-relative paths without quoting the tilde", () => {
  const filePath = join(homedir(), "projects/demo.txt");
  assertStrictEq(formatDisplayPath(filePath, { homeRelative: true }), "~/projects/demo.txt");
});

Deno.test("formatDisplayPath - escapes shell-unsafe characters in home-relative paths", () => {
  const filePath = join(homedir(), "My Files", "[draft] report.md");
  assertStrictEq(formatDisplayPath(filePath, { homeRelative: true }), "~/My\\ Files/\\[draft\\]\\ report.md");
});

Deno.test("formatDisplayPath - renders the home directory itself as a bare tilde", () => {
  assertStrictEq(formatDisplayPath(homedir(), { homeRelative: true }), "~");
});

Deno.test("formatDisplayPath - keeps non-home paths absolute in home-relative mode", () => {
  assertStrictEq(formatDisplayPath("/tmp/plain-file.txt", { homeRelative: true }), "/tmp/plain-file.txt");
});

Deno.test("parseArgs - parses repeated type selectors, recursion, and home-relative output", () => {
  assertEquals(
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
      separator: " ",
      useBasename: false,
      useQuotes: false,
    },
  );
});

Deno.test("parseArgs - keeps explicit files and all-selector together", () => {
  assertEquals(parseArgs(["--all", "a.txt", "b.txt"]).selectors, ["all"]);
  assertEquals(parseArgs(["--all", "a.txt", "b.txt"]).files, ["a.txt", "b.txt"]);
});

Deno.test("parseArgs - parses random count after type selector flags", () => {
  assertStrictEq(parseArgs(["--type", "text", "--random", "3"]).randomCount, 3);
});

Deno.test("parseArgs - rejects invalid random count", () => {
  assertThrows(() => parseArgs(["--random", "0"]), Error, "Invalid number for --random flag: 0");
});

Deno.test("parseArgs - rejects missing random count", () => {
  assertThrows(() => parseArgs(["--random"]), Error, "Usage: --random requires a number argument (e.g., --random 3)");
});

Deno.test("parseArgs - rejects invalid type values with valid groups listed", () => {
  assertThrows(() => parseArgs(["--type", "unknown"]), Error, "Invalid value for --type: unknown. Valid groups: images, subtitles, text");
});

Deno.test("parseArgs - rejects missing type value", () => {
  assertThrows(() => parseArgs(["--type"]), Error, "Usage: --type requires a value (images, subtitles, or text)");
});

Deno.test("parseArgs - parses newline separator from long flag", () => {
  assertStrictEq(parseArgs(["--separator", "\\n"]).separator, "\n");
});

Deno.test("parseArgs - rejects empty separator", () => {
  assertThrows(() => parseArgs(["--separator", ""]), Error, "--separator value cannot be empty");
});

Deno.test("parseArgs - rejects missing separator value", () => {
  assertThrows(() => parseArgs(["--separator"]), Error, 'Usage: --separator requires a value (e.g., --separator "\\n")');
});

Deno.test("parseArgs - enables content mode from long flag", () => {
  assertStrictEq(parseArgs(["--content"]).copyContent, true);
});

Deno.test("parseArgs - enables basename-only mode from long flag", () => {
  assertStrictEq(parseArgs(["--name-only"]).useBasename, true);
});

Deno.test("parseArgs - enables quote mode from long flag", () => {
  assertStrictEq(parseArgs(["--quote"]).useQuotes, true);
});

Deno.test("parseArgs - rejects legacy comma separator flag with migration guidance", () => {
  assertThrows(() => parseArgs(["-c"]), Error, 'Flag -c was removed. Use --separator "," instead.');
});

Deno.test("parseArgs - rejects legacy tab separator flag with migration guidance", () => {
  assertThrows(() => parseArgs(["-t"]), Error, 'Flag -t was removed. Use --separator "\\t" instead.');
});

Deno.test("parseArgs - rejects legacy line separator flag with migration guidance", () => {
  assertThrows(() => parseArgs(["-l"]), Error, 'Flag -l was removed. Use --separator "\\n" instead.');
});

Deno.test("parseArgs - rejects removed selector flags with migration guidance", () => {
  assertThrows(() => parseArgs(["--images"]), Error, "Flag --images was removed. Use --type images instead.");
  assertThrows(() => parseArgs(["--subtitles"]), Error, "Flag --subtitles was removed. Use --type subtitles instead.");
  assertThrows(() => parseArgs(["--text"]), Error, "Flag --text was removed. Use --type text instead.");
});

Deno.test("parseArgs - rejects removed short flags with migration guidance", () => {
  assertThrows(() => parseArgs(["-s", "\\t"]), Error, "Flag -s was removed. Use --separator instead.");
  assertThrows(() => parseArgs(["-C"]), Error, "Flag -C was removed. Use --content instead.");
  assertThrows(() => parseArgs(["-R"]), Error, "Flag -R was removed. Use --recursive instead.");
  assertThrows(() => parseArgs(["-H"]), Error, "Flag -H was removed. Use --home-relative instead.");
  assertThrows(() => parseArgs(["-r", "3"]), Error, "Flag -r was removed. Use --random instead.");
  assertThrows(() => parseArgs(["-b"]), Error, "Flag -b was removed. Use --name-only instead.");
  assertThrows(() => parseArgs(["-q"]), Error, "Flag -q was removed. Use --quote instead.");
});

Deno.test("decodeSeparatorValue - decodes supported escape sequences", () => {
  assertStrictEq(decodeSeparatorValue("\\n\\t\\r\\\\"), "\n\t\r\\");
});

Deno.test("decodeSeparatorValue - leaves unknown escape sequences literal", () => {
  assertStrictEq(decodeSeparatorValue("\\x\\z"), "\\x\\z");
});

Deno.test("buildContentBlocks - formats one file as full path, blank line, and content", () => {
  assertStrictEq(
    buildContentBlocks([
      { resolvedPath: "/tmp/a.txt", fileContent: "alpha\nbeta" },
    ]),
    "/tmp/a.txt\n\nalpha\nbeta",
  );
});

Deno.test("buildContentBlocks - joins multiple files with blank lines between blocks in order", () => {
  assertStrictEq(
    buildContentBlocks([
      { resolvedPath: "/tmp/a.txt", fileContent: "alpha" },
      { resolvedPath: "/tmp/b.txt", fileContent: "beta" },
    ]),
    "/tmp/a.txt\n\nalpha\n\n/tmp/b.txt\n\nbeta",
  );
});

Deno.test("buildContentBlocks - returns just content when path mode is none", () => {
  assertStrictEq(
    buildContentBlocks([
      { resolvedPath: "/tmp/a.txt", fileContent: "alpha" },
      { resolvedPath: "/tmp/b.txt", fileContent: "beta" },
    ], "none"),
    "alpha\n\nbeta",
  );
});

Deno.test("validateParsedArgs - allows home-relative output on its own", () => {
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
  });
});

Deno.test("validateParsedArgs - rejects home-relative with quote mode", () => {
  assertThrows(
    () =>
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
    Error,
    "--home-relative cannot be combined with --content, --name-only, or --quote",
  );
});

Deno.test("validateParsedArgs - rejects home-relative with basename mode", () => {
  assertThrows(
    () =>
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
    Error,
    "--home-relative cannot be combined with --content, --name-only, or --quote",
  );
});

Deno.test("validateParsedArgs - rejects home-relative with content mode", () => {
  assertThrows(
    () =>
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
    Error,
    "--home-relative cannot be combined with --content, --name-only, or --quote",
  );
});

Deno.test("mergeUniquePaths - keeps the first occurrence order across explicit and selector files", () => {
  assertEquals(
    mergeUniquePaths(
      ["./manual-a.srt", "./manual-b.srt"],
      ["./manual-b.srt", "./found-c.srt", "./manual-a.srt"],
    ),
    ["./manual-a.srt", "./manual-b.srt", "./found-c.srt"],
  );
});

Deno.test("applyRandomSelection - applies random slicing after shuffle", () => {
  const result = applyRandomSelection(
    ["a", "b", "c", "d"],
    2,
    (items) => [...items].reverse(),
  );

  assertEquals(result, ["d", "c"]);
});

Deno.test("applyRandomSelection - returns original items when random mode is disabled", () => {
  assertEquals(applyRandomSelection(["a", "b"], null), ["a", "b"]);
});