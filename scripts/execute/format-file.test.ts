import { assertEquals, assertStrictEq } from "jsr:@std/assert";

import {
  buildSpinnerLabel,
  formatFileWithPrettier,
  formatWithPrettierInSubprocess,
  formatElapsedDuration,
  PRETTIER_ENTRYPOINT_ENV,
  renderResultLine,
  renderSpinnerFrame,
  resolvePrettierModuleSpecifier,
} from "./format-file.ts";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

Deno.test("resolvePrettierModuleSpecifier - falls back to bare prettier import without an injected entrypoint", () => {
  assertStrictEq(resolvePrettierModuleSpecifier({}), "prettier");
});

Deno.test("resolvePrettierModuleSpecifier - converts an injected filesystem path into a file URL", () => {
  assertStrictEq(
    resolvePrettierModuleSpecifier({
      [PRETTIER_ENTRYPOINT_ENV]:
        "/nix/store/example-prettier/lib/node_modules/prettier/index.mjs",
    }),
    "file:///nix/store/example-prettier/lib/node_modules/prettier/index.mjs",
  );
});

Deno.test("formatElapsedDuration - keeps millisecond precision for fast operations", () => {
  assertStrictEq(formatElapsedDuration(12.34), "12.3ms");
});

Deno.test("formatElapsedDuration - switches to seconds for longer operations", () => {
  assertStrictEq(formatElapsedDuration(1534), "1.5s");
});

Deno.test("buildSpinnerLabel - shows a single active file directly", () => {
  assertStrictEq(buildSpinnerLabel(["scripts/execute/format-file.ts"], 0, 1), "1/1 formatting: scripts/execute/format-file.ts");
});

Deno.test("buildSpinnerLabel - summarizes multiple active files into one line", () => {
  assertStrictEq(buildSpinnerLabel(["a.ts", "b.ts", "c.ts", "d.ts"], 2, 6), "3/6 formatting: a.ts, b.ts +2");
});

Deno.test("terminal output helpers - renders a spinner frame with progress label on one line", () => {
  assertStrictEq(renderSpinnerFrame(0, ["a.ts", "b.ts"], 0, 2), "\r\x1b[2K\x1b[90m-\x1b[0m 1/2 formatting: a.ts, b.ts");
});

Deno.test("terminal output helpers - renders result lines without the legacy START prefix", () => {
  assertStrictEq(renderResultLine("Updated", "12.3ms", "a.ts"), "\x1b[32mUpdated\x1b[0m (12.3ms): a.ts");
  assertStrictEq(renderResultLine("Updated", "12.3ms", "a.ts").includes("START"), false);
});

Deno.test("formatWithPrettierInSubprocess - formats markdown in a subprocess so the caller can stay responsive", async () => {
  const formatted = await formatWithPrettierInSubprocess({
    content: "alpha\nbeta\n",
    parser: "markdown",
  });

  assertStrictEq(formatted, "alpha\n\nbeta\n");
});

Deno.test("formatFileWithPrettier - formats a markdown file in place and reports unchanged on the second run", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "format-file-test-"));
  const filePath = join(tempDir, "sample.md");

  try {
    await writeFile(filePath, "alpha\nbeta\n");

    assertEquals(await formatFileWithPrettier(filePath), { status: "updated" });
    assertStrictEq(await readFile(filePath, "utf8"), "alpha\n\nbeta\n");

    assertEquals(await formatFileWithPrettier(filePath), { status: "unchanged" });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});