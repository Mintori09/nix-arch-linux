import { describe, expect, test } from "bun:test";
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
  test("parses repeated type selectors, recursion, and home-relative output", () => {
    expect(
      parseArgs([
        "--type",
        "subtitles",
        "--type",
        "images",
        "--recursive",
        "--home-relative",
        "movie.mkv",
      ]),
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

  test("parses random count after type selector flags", () => {
    expect(parseArgs(["--type", "text", "--random", "3"]).randomCount).toBe(3);
  });

  test("rejects invalid random count", () => {
    expect(() => parseArgs(["--random", "0"])).toThrow(
      "Invalid number for --random flag: 0",
    );
  });

  test("rejects missing random count", () => {
    expect(() => parseArgs(["--random"])).toThrow(
      "Usage: --random requires a number argument (e.g., --random 3)",
    );
  });

  test("rejects invalid type values with valid groups listed", () => {
    expect(() => parseArgs(["--type", "unknown"])).toThrow(
      'Invalid value for --type: unknown. Valid groups: images, subtitles, text',
    );
  });

  test("rejects missing type value", () => {
    expect(() => parseArgs(["--type"])).toThrow(
      "Usage: --type requires a value (images, subtitles, or text)",
    );
  });

  test("parses newline separator from long flag", () => {
    expect(parseArgs(["--separator", "\\n"]).separator).toBe("\n");
  });

  test("rejects empty separator", () => {
    expect(() => parseArgs(["--separator", ""])).toThrow(
      "--separator value cannot be empty",
    );
  });

  test("rejects missing separator value", () => {
    expect(() => parseArgs(["--separator"])).toThrow(
      "Usage: --separator requires a value (e.g., --separator \"\\n\")",
    );
  });

  test("enables content mode from long flag", () => {
    expect(parseArgs(["--content"]).copyContent).toBe(true);
  });

  test("enables basename-only mode from long flag", () => {
    expect(parseArgs(["--name-only"]).useBasename).toBe(true);
  });

  test("enables quote mode from long flag", () => {
    expect(parseArgs(["--quote"]).useQuotes).toBe(true);
  });

  test("rejects legacy comma separator flag with migration guidance", () => {
    expect(() => parseArgs(["-c"])).toThrow(
      'Flag -c was removed. Use --separator "," instead.',
    );
  });

  test("rejects legacy tab separator flag with migration guidance", () => {
    expect(() => parseArgs(["-t"])).toThrow(
      'Flag -t was removed. Use --separator "\\t" instead.',
    );
  });

  test("rejects legacy line separator flag with migration guidance", () => {
    expect(() => parseArgs(["-l"])).toThrow(
      'Flag -l was removed. Use --separator "\\n" instead.',
    );
  });

  test("rejects removed selector flags with migration guidance", () => {
    expect(() => parseArgs(["--images"])).toThrow(
      'Flag --images was removed. Use --type images instead.',
    );
    expect(() => parseArgs(["--subtitles"])).toThrow(
      'Flag --subtitles was removed. Use --type subtitles instead.',
    );
    expect(() => parseArgs(["--text"])).toThrow(
      'Flag --text was removed. Use --type text instead.',
    );
  });

  test("rejects removed short flags with migration guidance", () => {
    expect(() => parseArgs(["-s", "\\t"])).toThrow(
      "Flag -s was removed. Use --separator instead.",
    );
    expect(() => parseArgs(["-C"])).toThrow(
      "Flag -C was removed. Use --content instead.",
    );
    expect(() => parseArgs(["-R"])).toThrow(
      "Flag -R was removed. Use --recursive instead.",
    );
    expect(() => parseArgs(["-H"])).toThrow(
      "Flag -H was removed. Use --home-relative instead.",
    );
    expect(() => parseArgs(["-r", "3"])).toThrow(
      "Flag -r was removed. Use --random instead.",
    );
    expect(() => parseArgs(["-b"])).toThrow(
      "Flag -b was removed. Use --name-only instead.",
    );
    expect(() => parseArgs(["-q"])).toThrow(
      "Flag -q was removed. Use --quote instead.",
    );
  });
});

describe("decodeSeparatorValue", () => {
  test("decodes supported escape sequences", () => {
    expect(decodeSeparatorValue("\\n\\t\\r\\\\")).toBe("\n\t\r\\");
  });

  test("leaves unknown escape sequences literal", () => {
    expect(decodeSeparatorValue("\\x\\z")).toBe("\\x\\z");
  });
});

describe("buildContentBlocks", () => {
  test("formats one file as full path, blank line, and content", () => {
    expect(
      buildContentBlocks([
        { resolvedPath: "/tmp/a.txt", fileContent: "alpha\nbeta" },
      ]),
    ).toBe("/tmp/a.txt\n\nalpha\nbeta");
  });

  test("joins multiple files with blank lines between blocks in order", () => {
    expect(
      buildContentBlocks([
        { resolvedPath: "/tmp/a.txt", fileContent: "alpha" },
        { resolvedPath: "/tmp/b.txt", fileContent: "beta" },
      ]),
    ).toBe("/tmp/a.txt\n\nalpha\n\n/tmp/b.txt\n\nbeta");
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
    ).toThrow(
      "--home-relative cannot be combined with --content, --name-only, or --quote",
    );
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
    ).toThrow(
      "--home-relative cannot be combined with --content, --name-only, or --quote",
    );
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
    ).toThrow(
      "--home-relative cannot be combined with --content, --name-only, or --quote",
    );
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
