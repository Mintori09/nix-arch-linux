import { describe, it } from "node:test";
import assert from "node:assert";

import {
  buildSpinnerLabel,
  formatFileWithPrettier,
  formatWithPrettierInSubprocess,
  formatElapsedDuration,
  PRETTIER_ENTRYPOINT_ENV,
  renderResultLine,
  renderSpinnerFrame,
  resolvePrettierModuleSpecifier,
} from "./format-file";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("resolvePrettierModuleSpecifier", () => {
  it("falls back to bare prettier import without an injected entrypoint", () => {
    assert.strictEqual(resolvePrettierModuleSpecifier({}), "prettier");
  });

  it("converts an injected filesystem path into a file URL", () => {
    assert.strictEqual(
      resolvePrettierModuleSpecifier({
        [PRETTIER_ENTRYPOINT_ENV]:
          "/nix/store/example-prettier/lib/node_modules/prettier/index.mjs",
      }),
      "file:///nix/store/example-prettier/lib/node_modules/prettier/index.mjs",
    );
  });
});

describe("formatElapsedDuration", () => {
  it("keeps millisecond precision for fast operations", () => {
    assert.strictEqual(formatElapsedDuration(12.34), "12.3ms");
  });

  it("switches to seconds for longer operations", () => {
    assert.strictEqual(formatElapsedDuration(1534), "1.5s");
  });
});

describe("buildSpinnerLabel", () => {
  it("shows a single active file directly", () => {
    assert.strictEqual(buildSpinnerLabel(["scripts/execute/format-file.ts"], 0, 1), "1/1 formatting: scripts/execute/format-file.ts");
  });

  it("summarizes multiple active files into one line", () => {
    assert.strictEqual(buildSpinnerLabel(["a.ts", "b.ts", "c.ts", "d.ts"], 2, 6), "3/6 formatting: a.ts, b.ts +2");
  });
});

describe("terminal output helpers", () => {
  it("renders a spinner frame with progress label on one line", () => {
    assert.strictEqual(renderSpinnerFrame(0, ["a.ts", "b.ts"], 0, 2), "\r\x1b[2K\x1b[90m-\x1b[0m 1/2 formatting: a.ts, b.ts");
  });

  it("renders result lines without the legacy START prefix", () => {
    assert.strictEqual(renderResultLine("Updated", "12.3ms", "a.ts"), "\x1b[32mUpdated\x1b[0m (12.3ms): a.ts");
    assert.ok(!renderResultLine("Updated", "12.3ms", "a.ts").includes("START"));
  });
});

describe("formatWithPrettierInSubprocess", () => {
  it("formats markdown in a subprocess so the caller can stay responsive", async () => {
    const formatted = await formatWithPrettierInSubprocess({
      content: "alpha\nbeta\n",
      parser: "markdown",
    });

    assert.strictEqual(formatted, "alpha\n\nbeta\n");
  });
});

describe("formatFileWithPrettier", () => {
  it("formats a markdown file in place and reports unchanged on the second run", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "format-file-test-"));
    const filePath = join(tempDir, "sample.md");

    try {
      await writeFile(filePath, "alpha\nbeta\n");

      assert.deepStrictEqual(await formatFileWithPrettier(filePath), { status: "updated" });
      assert.strictEqual(await readFile(filePath, "utf8"), "alpha\n\nbeta\n");

      assert.deepStrictEqual(await formatFileWithPrettier(filePath), { status: "unchanged" });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
