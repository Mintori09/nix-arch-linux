import { describe, expect, test } from "bun:test";

import {
  buildSpinnerLabel,
  formatElapsedDuration,
  PRETTIER_ENTRYPOINT_ENV,
  renderResultLine,
  renderSpinnerFrame,
  resolvePrettierModuleSpecifier,
} from "./format-file";

describe("resolvePrettierModuleSpecifier", () => {
  test("falls back to bare prettier import without an injected entrypoint", () => {
    expect(resolvePrettierModuleSpecifier({})).toBe("prettier");
  });

  test("converts an injected filesystem path into a file URL", () => {
    expect(
      resolvePrettierModuleSpecifier({
        [PRETTIER_ENTRYPOINT_ENV]:
          "/nix/store/example-prettier/lib/node_modules/prettier/index.mjs",
      }),
    ).toBe(
      "file:///nix/store/example-prettier/lib/node_modules/prettier/index.mjs",
    );
  });
});

describe("formatElapsedDuration", () => {
  test("keeps millisecond precision for fast operations", () => {
    expect(formatElapsedDuration(12.34)).toBe("12.3ms");
  });

  test("switches to seconds for longer operations", () => {
    expect(formatElapsedDuration(1534)).toBe("1.5s");
  });
});

describe("buildSpinnerLabel", () => {
  test("shows a single active file directly", () => {
    expect(buildSpinnerLabel(["scripts/execute/format-file.ts"], 0, 1)).toBe(
      "1/1 formatting: scripts/execute/format-file.ts",
    );
  });

  test("summarizes multiple active files into one line", () => {
    expect(
      buildSpinnerLabel(
        ["a.ts", "b.ts", "c.ts", "d.ts"],
        2,
        6,
      ),
    ).toBe("3/6 formatting: a.ts, b.ts +2");
  });
});

describe("terminal output helpers", () => {
  test("renders a spinner frame with progress label on one line", () => {
    expect(renderSpinnerFrame(0, ["a.ts", "b.ts"], 0, 2)).toBe(
      "\r\x1b[2K\x1b[90m-\x1b[0m 1/2 formatting: a.ts, b.ts",
    );
  });

  test("renders result lines without the legacy START prefix", () => {
    expect(renderResultLine("Updated", "12.3ms", "a.ts")).toBe(
      "\x1b[32mUpdated\x1b[0m (12.3ms): a.ts",
    );
    expect(renderResultLine("Updated", "12.3ms", "a.ts")).not.toContain(
      "START",
    );
  });
});
