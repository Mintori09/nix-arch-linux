import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildSpinnerLabel,
  formatFileWithPrettier,
  formatWithPrettierInSubprocess,
  formatElapsedDuration,
  PRETTIER_ENTRYPOINT_ENV,
  renderResultLine,
  renderSpinnerFrame,
  resolvePrettierModuleSpecifier,
  formatEpubFile,
  printHelp,
} from "./format-file.ts";
import { spawnAsync } from "./utils.ts";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

it("resolvePrettierModuleSpecifier - falls back to bare prettier import without an injected entrypoint", () => {
  assert.strictEqual(resolvePrettierModuleSpecifier({}), "prettier");
});

it("resolvePrettierModuleSpecifier - converts an injected filesystem path into a file URL", () => {
  assert.strictEqual(
    resolvePrettierModuleSpecifier({
      [PRETTIER_ENTRYPOINT_ENV]:
        "/nix/store/example-prettier/lib/node_modules/prettier/index.mjs",
    }),
    "file:///nix/store/example-prettier/lib/node_modules/prettier/index.mjs",
  );
});

it("formatElapsedDuration - keeps millisecond precision for fast operations", () => {
  assert.strictEqual(formatElapsedDuration(12.34), "12.3ms");
});

it("formatElapsedDuration - switches to seconds for longer operations", () => {
  assert.strictEqual(formatElapsedDuration(1534), "1.5s");
});

it("buildSpinnerLabel - shows a single active file directly", () => {
  assert.strictEqual(
    buildSpinnerLabel(["scripts/execute/format-file.ts"], 0, 1),
    "1/1 formatting: scripts/execute/format-file.ts",
  );
});

it("buildSpinnerLabel - summarizes multiple active files into one line", () => {
  assert.strictEqual(
    buildSpinnerLabel(["a.ts", "b.ts", "c.ts", "d.ts"], 2, 6),
    "3/6 formatting: a.ts, b.ts +2",
  );
});

it("terminal output helpers - renders a spinner frame with progress label on one line", () => {
  assert.strictEqual(
    renderSpinnerFrame(0, ["a.ts", "b.ts"], 0, 2),
    "\r\x1b[2K\x1b[90m-\x1b[0m 1/2 formatting: a.ts, b.ts",
  );
});

it("terminal output helpers - renders result lines without the legacy START prefix", () => {
  assert.strictEqual(
    renderResultLine("Updated", "12.3ms", "a.ts"),
    "\x1b[32mUpdated\x1b[0m (12.3ms): a.ts",
  );
  assert.strictEqual(
    renderResultLine("Updated", "12.3ms", "a.ts").includes("START"),
    false,
  );
});

it("formatWithPrettierInSubprocess - formats markdown in a subprocess so the caller can stay responsive", async () => {
  const formatted = await formatWithPrettierInSubprocess({
    content: "alpha\nbeta\n",
    parser: "markdown",
  });

  assert.strictEqual(formatted, "alpha\n\nbeta\n");
});

it("formatFileWithPrettier - formats a markdown file in place and reports unchanged on the second run", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "format-file-test-"));
  const filePath = join(tempDir, "sample.md");

  try {
    await writeFile(filePath, "alpha\nbeta\n");

    assert.deepEqual(await formatFileWithPrettier(filePath), {
      status: "updated",
    });
    assert.strictEqual(await readFile(filePath, "utf8"), "alpha\n\nbeta\n");

    assert.deepEqual(await formatFileWithPrettier(filePath), {
      status: "unchanged",
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

it("printHelp - writes usage and format information including epub to stdout", () => {
  let output = "";
  const originalWrite = process.stdout.write;
  try {
    process.stdout.write = ((chunk: any) => {
      output += chunk.toString();
      return true;
    }) as any;
    printHelp();
  } finally {
    process.stdout.write = originalWrite;
  }

  assert.ok(output.includes("Usage: format"));
  assert.ok(output.includes("--help"));
  assert.ok(output.includes(".epub"));
});

it("formatEpubFile - unpacks, formats internal markup and styles, and repacks epub", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "format-epub-test-"));
  const stagingDir = join(tempDir, "staging");
  const epubPath = join(tempDir, "sample.epub");

  try {
    await spawnAsync("mkdir", ["-p", join(stagingDir, "META-INF"), join(stagingDir, "OEBPS")]);
    await writeFile(join(stagingDir, "mimetype"), "application/epub+zip");
    await writeFile(
      join(stagingDir, "META-INF", "container.xml"),
      '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    );
    await writeFile(
      join(stagingDir, "OEBPS", "chapter1.xhtml"),
      '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>   test    spacing   </p></body></html>',
    );
    await writeFile(
      join(stagingDir, "OEBPS", "style.css"),
      "body {   margin:   0;   color: #000; }",
    );

    await spawnAsync("zip", ["-0", "-X", "-q", epubPath, "mimetype"], { cwd: stagingDir });
    await spawnAsync("zip", ["-r", "-X", "-q", epubPath, "META-INF", "OEBPS"], { cwd: stagingDir });

    const firstRun = await formatEpubFile(epubPath);
    assert.deepEqual(firstRun, { status: "updated" });

    // Verify formatted content inside repacked epub
    const verifyDir = join(tempDir, "verify");
    await spawnAsync("mkdir", ["-p", verifyDir]);
    await spawnAsync("unzip", ["-q", epubPath, "-d", verifyDir]);

    const formattedXhtml = await readFile(join(verifyDir, "OEBPS", "chapter1.xhtml"), "utf8");
    assert.ok(formattedXhtml.includes("<p>test spacing</p>"));

    const formattedCss = await readFile(join(verifyDir, "OEBPS", "style.css"), "utf8");
    assert.ok(formattedCss.includes("margin: 0;"));

    // Second run should report unchanged
    const secondRun = await formatEpubFile(epubPath);
    assert.deepEqual(secondRun, { status: "unchanged" });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

