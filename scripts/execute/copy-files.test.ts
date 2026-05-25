import { describe, it } from "node:test";
import assert from "node:assert";
import { homedir } from "os";
import { join } from "path";

import {
  applyRandomSelection,
  buildContentBlocks,
  decodeSeparatorValue,
  formatDisplayPath,
  parseArgs,
  shouldQuotePath,
  validateParsedArgs,
  mergeUniquePaths,
} from "./copy-files";

describe("shouldQuotePath", () => {
  it("returns false for simple shell-safe paths", () => {
    assert.strictEqual(shouldQuotePath("/tmp/plain-file.txt"), false);
  });

  it("returns true for paths containing whitespace", () => {
    assert.strictEqual(shouldQuotePath("/tmp/two words.txt"), true);
  });

  it("returns true for paths containing shell-sensitive characters", () => {
    assert.strictEqual(shouldQuotePath("/tmp/[2] Obsidian/report.md"), true);
  });
});

describe("formatDisplayPath", () => {
  it("auto-wraps full paths with whitespace in double quotes", () => {
    assert.strictEqual(formatDisplayPath("/tmp/two words.txt"), '"/tmp/two words.txt"');
  });

  it("auto-wraps full paths with shell-sensitive characters in double quotes", () => {
    assert.strictEqual(formatDisplayPath("/tmp/[2] Obsidian/report.md"), '"/tmp/[2] Obsidian/report.md"');
  });

  it("leaves shell-safe paths unquoted by default", () => {
    assert.strictEqual(formatDisplayPath("/tmp/plain-file.txt"), "/tmp/plain-file.txt");
  });

  it("always quotes when the explicit quote option is enabled", () => {
    assert.strictEqual(formatDisplayPath("/tmp/plain-file.txt", { alwaysQuote: true }), '"/tmp/plain-file.txt"');
  });

  it("applies the same auto-quote rule in basename mode", () => {
    assert.strictEqual(formatDisplayPath("deep research report.md"), '"deep research report.md"');
  });

  it("renders home-relative paths without quoting the tilde", () => {
    const filePath = join(homedir(), "projects/demo.txt");
    assert.strictEqual(formatDisplayPath(filePath, { homeRelative: true }), "~/projects/demo.txt");
  });

  it("escapes shell-unsafe characters in home-relative paths", () => {
    const filePath = join(homedir(), "My Files", "[draft] report.md");
    assert.strictEqual(formatDisplayPath(filePath, { homeRelative: true }), "~/My\\ Files/\\[draft\\]\\ report.md");
  });

  it("renders the home directory itself as a bare tilde", () => {
    assert.strictEqual(formatDisplayPath(homedir(), { homeRelative: true }), "~");
  });

  it("keeps non-home paths absolute in home-relative mode", () => {
    assert.strictEqual(formatDisplayPath("/tmp/plain-file.txt", { homeRelative: true }), "/tmp/plain-file.txt");
  });
});

describe("parseArgs", () => {
  it("parses repeated type selectors, recursion, and home-relative output", () => {
    assert.deepStrictEqual(
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

  it("keeps explicit files and all-selector together", () => {
    assert.deepStrictEqual(parseArgs(["--all", "a.txt", "b.txt"]).selectors, ["all"]);
    assert.deepStrictEqual(parseArgs(["--all", "a.txt", "b.txt"]).files, ["a.txt", "b.txt"]);
  });

  it("parses random count after type selector flags", () => {
    assert.strictEqual(parseArgs(["--type", "text", "--random", "3"]).randomCount, 3);
  });

  it("rejects invalid random count", () => {
    assert.throws(() => parseArgs(["--random", "0"]), { message: "Invalid number for --random flag: 0" });
  });

  it("rejects missing random count", () => {
    assert.throws(() => parseArgs(["--random"]), { message: "Usage: --random requires a number argument (e.g., --random 3)" });
  });

  it("rejects invalid type values with valid groups listed", () => {
    assert.throws(() => parseArgs(["--type", "unknown"]), { message: 'Invalid value for --type: unknown. Valid groups: images, subtitles, text' });
  });

  it("rejects missing type value", () => {
    assert.throws(() => parseArgs(["--type"]), { message: "Usage: --type requires a value (images, subtitles, or text)" });
  });

  it("parses newline separator from long flag", () => {
    assert.strictEqual(parseArgs(["--separator", "\\n"]).separator, "\n");
  });

  it("rejects empty separator", () => {
    assert.throws(() => parseArgs(["--separator", ""]), { message: "--separator value cannot be empty" });
  });

  it("rejects missing separator value", () => {
    assert.throws(() => parseArgs(["--separator"]), { message: 'Usage: --separator requires a value (e.g., --separator "\\n")' });
  });

  it("enables content mode from long flag", () => {
    assert.strictEqual(parseArgs(["--content"]).copyContent, true);
  });

  it("enables basename-only mode from long flag", () => {
    assert.strictEqual(parseArgs(["--name-only"]).useBasename, true);
  });

  it("enables quote mode from long flag", () => {
    assert.strictEqual(parseArgs(["--quote"]).useQuotes, true);
  });

  it("rejects legacy comma separator flag with migration guidance", () => {
    assert.throws(() => parseArgs(["-c"]), { message: 'Flag -c was removed. Use --separator "," instead.' });
  });

  it("rejects legacy tab separator flag with migration guidance", () => {
    assert.throws(() => parseArgs(["-t"]), { message: 'Flag -t was removed. Use --separator "\\t" instead.' });
  });

  it("rejects legacy line separator flag with migration guidance", () => {
    assert.throws(() => parseArgs(["-l"]), { message: 'Flag -l was removed. Use --separator "\\n" instead.' });
  });

  it("rejects removed selector flags with migration guidance", () => {
    assert.throws(() => parseArgs(["--images"]), { message: 'Flag --images was removed. Use --type images instead.' });
    assert.throws(() => parseArgs(["--subtitles"]), { message: 'Flag --subtitles was removed. Use --type subtitles instead.' });
    assert.throws(() => parseArgs(["--text"]), { message: 'Flag --text was removed. Use --type text instead.' });
  });

  it("rejects removed short flags with migration guidance", () => {
    assert.throws(() => parseArgs(["-s", "\\t"]), { message: "Flag -s was removed. Use --separator instead." });
    assert.throws(() => parseArgs(["-C"]), { message: "Flag -C was removed. Use --content instead." });
    assert.throws(() => parseArgs(["-R"]), { message: "Flag -R was removed. Use --recursive instead." });
    assert.throws(() => parseArgs(["-H"]), { message: "Flag -H was removed. Use --home-relative instead." });
    assert.throws(() => parseArgs(["-r", "3"]), { message: "Flag -r was removed. Use --random instead." });
    assert.throws(() => parseArgs(["-b"]), { message: "Flag -b was removed. Use --name-only instead." });
    assert.throws(() => parseArgs(["-q"]), { message: "Flag -q was removed. Use --quote instead." });
  });
});

describe("decodeSeparatorValue", () => {
  it("decodes supported escape sequences", () => {
    assert.strictEqual(decodeSeparatorValue("\\n\\t\\r\\\\"), "\n\t\r\\");
  });

  it("leaves unknown escape sequences literal", () => {
    assert.strictEqual(decodeSeparatorValue("\\x\\z"), "\\x\\z");
  });
});

describe("buildContentBlocks", () => {
  it("formats one file as full path, blank line, and content", () => {
    assert.strictEqual(
      buildContentBlocks([
        { resolvedPath: "/tmp/a.txt", fileContent: "alpha\nbeta" },
      ]),
      "/tmp/a.txt\n\nalpha\nbeta",
    );
  });

  it("joins multiple files with blank lines between blocks in order", () => {
    assert.strictEqual(
      buildContentBlocks([
        { resolvedPath: "/tmp/a.txt", fileContent: "alpha" },
        { resolvedPath: "/tmp/b.txt", fileContent: "beta" },
      ]),
      "/tmp/a.txt\n\nalpha\n\n/tmp/b.txt\n\nbeta",
    );
  });

  it("returns just content when path mode is none", () => {
    assert.strictEqual(
      buildContentBlocks([
        { resolvedPath: "/tmp/a.txt", fileContent: "alpha" },
        { resolvedPath: "/tmp/b.txt", fileContent: "beta" },
      ], "none"),
      "alpha\n\nbeta",
    );
  });
});

describe("validateParsedArgs", () => {
  it("allows home-relative output on its own", () => {
    assert.doesNotThrow(() =>
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
    );
  });

  it("rejects home-relative with quote mode", () => {
    assert.throws(() =>
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
      { message: "--home-relative cannot be combined with --content, --name-only, or --quote" },
    );
  });

  it("rejects home-relative with basename mode", () => {
    assert.throws(() =>
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
      { message: "--home-relative cannot be combined with --content, --name-only, or --quote" },
    );
  });

  it("rejects home-relative with content mode", () => {
    assert.throws(() =>
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
      { message: "--home-relative cannot be combined with --content, --name-only, or --quote" },
    );
  });
});

describe("mergeUniquePaths", () => {
  it("keeps the first occurrence order across explicit and selector files", () => {
    assert.deepStrictEqual(
      mergeUniquePaths(
        ["./manual-a.srt", "./manual-b.srt"],
        ["./manual-b.srt", "./found-c.srt", "./manual-a.srt"],
      ),
      ["./manual-a.srt", "./manual-b.srt", "./found-c.srt"],
    );
  });
});

describe("applyRandomSelection", () => {
  it("applies random slicing after shuffle", () => {
    const result = applyRandomSelection(
      ["a", "b", "c", "d"],
      2,
      (items) => [...items].reverse(),
    );

    assert.deepStrictEqual(result, ["d", "c"]);
  });

  it("returns original items when random mode is disabled", () => {
    assert.deepStrictEqual(applyRandomSelection(["a", "b"], null), ["a", "b"]);
  });
});
