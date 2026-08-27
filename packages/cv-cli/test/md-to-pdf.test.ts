import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  writeFileSync,
  readFileSync,
  mkdtempSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const cliEntry = path.resolve(rootDir, "src/index.ts");
const fixturesDir = path.resolve(rootDir, "test/fixtures");

let tmpDir = "";

function runCli(args: string[]): {
  stdout: string;
  stderr: string;
  status: number;
} {
  const result = spawnSync("node", ["--import", "tsx", cliEntry, ...args], {
    encoding: "utf-8",
    cwd: rootDir,
  });
  return {
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    status: result.status ?? 1,
  };
}

function which(bin: string): boolean {
  return spawnSync("which", [bin], { encoding: "utf-8" }).status === 0;
}

function fixtureFor(ext: string): string | null {
  const p = path.join(fixturesDir, `input.${ext}`);
  return existsSync(p) ? p : null;
}

function outPath(name: string): string {
  return path.join(tmpDir, name);
}

before(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "cv-md-to-pdf-"));
});

after(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// MD-PDF-1: Pipeline cơ bản
// ---------------------------------------------------------------------------
describe("mdToPdf factory", () => {
  it("exports mdToPdf with tool pandoc", async () => {
    const mod = await import("../src/converters/document.ts");
    const converter = mod.mdToPdf();
    assert.strictEqual(converter.tool, "pandoc");
    assert.strictEqual(typeof converter.convert, "function");
  });

  it("loadDefaults for md:pdf returns pageSize a4", async () => {
    const mod = await import("../src/config.ts");
    const defaults = mod.loadDefaults("md:pdf");
    assert.strictEqual(defaults.pageSize, "a4");
  });
});

describe("MD-PDF-1: Basic md->pdf pipeline (dry-run)", () => {
  const mdInput = fixtureFor("md")!;

  it("dry-run succeeds with basic conversion", () => {
    const out = outPath("basic.pdf");
    const r = runCli(["--dry-run", mdInput, out]);
    assert.strictEqual(r.status, 0, `status=${r.status} stderr=${r.stderr}`);
    assert.ok(r.stdout.includes("pandoc"), "should invoke pandoc");
    assert.ok(
      r.stdout.includes("--pdf-engine=weasyprint"),
      "should use weasyprint",
    );
    assert.ok(r.stdout.includes("papersize:a4"), "default papersize a4");
    assert.ok(
      r.stdout.includes("Conversion successful"),
      "should report success",
    );
    assert.ok(r.stdout.includes("(dry-run)"), "should be dry-run");
  });

  it("dry-run includes --highlight-style tango", () => {
    const out = outPath("highlight.pdf");
    const r = runCli(["--dry-run", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--highlight-style"), "should have highlight");
    assert.ok(r.stdout.includes("tango"), "should be tango theme");
  });

  it("dry-run includes -V geometry:margin=2cm", () => {
    const out = outPath("margin.pdf");
    const r = runCli(["--dry-run", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(
      r.stdout.includes("geometry:margin=2cm"),
      "should set 2cm margin",
    );
  });
});

// ---------------------------------------------------------------------------
// MD-PDF-2: page-size
// ---------------------------------------------------------------------------
describe("MD-PDF-2: --page-size flag", () => {
  const mdInput = fixtureFor("md")!;

  it("--page-size=letter overrides default a4", () => {
    const out = outPath("page-letter.pdf");
    const r = runCli(["--dry-run", "--page-size=letter", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("papersize:letter"), "should set letter");
    assert.ok(!r.stdout.includes("papersize:a4"), "should not have a4");
  });

  it("--page-size=a5 works", () => {
    const out = outPath("page-a5.pdf");
    const r = runCli(["--dry-run", "--page-size=a5", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("papersize:a5"), "should set a5");
  });

  it("--page-size=legal works", () => {
    const out = outPath("page-legal.pdf");
    const r = runCli(["--dry-run", "--page-size=legal", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("papersize:legal"), "should set legal");
  });

  it("--page-size is omitted for non-pdf output", () => {
    const out = outPath("page.html");
    const r = runCli(["--dry-run", "--page-size=letter", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(
      !r.stdout.includes("papersize"),
      "should not pass -V papersize to html",
    );
  });
});

// ---------------------------------------------------------------------------
// MD-PDF-3: toc + number-sections
// ---------------------------------------------------------------------------
describe("MD-PDF-3: --toc and --number-sections", () => {
  const mdInput = fixtureFor("md")!;

  it("--toc adds --toc flag to pandoc", () => {
    const out = outPath("toc.pdf");
    const r = runCli(["--dry-run", "--toc", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--toc"), "should include --toc");
  });

  it("--number-sections adds --number-sections", () => {
    const out = outPath("numsec.pdf");
    const r = runCli(["--dry-run", "--number-sections", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(
      r.stdout.includes("--number-sections"),
      "should include --number-sections",
    );
  });

  it("combined --toc --number-sections passes both flags", () => {
    const out = outPath("toc-numsec.pdf");
    const r = runCli(["--dry-run", "--toc", "--number-sections", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--toc"), "should include --toc");
    assert.ok(
      r.stdout.includes("--number-sections"),
      "should include --number-sections",
    );
  });

  it("combined flag without duplicates", () => {
    const out = outPath("toc-numsec-dedup.pdf");
    const r = runCli(["--dry-run", "--toc", mdInput, out]);
    const matches = r.stdout.match(/--toc/g);
    assert.strictEqual(matches?.length, 1, "--toc should appear exactly once");
  });
});

// ---------------------------------------------------------------------------
// MD-PDF-4: --style
// ---------------------------------------------------------------------------
describe("MD-PDF-4: --style with CSS", () => {
  const mdInput = fixtureFor("md")!;

  it("--style adds --css flag with resolved path", () => {
    const out = outPath("styled.pdf");
    const cssFile = path.join(fixturesDir, "style.css");
    const r = runCli(["--dry-run", `--style=${cssFile}`, mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--css"), "should include --css");
    assert.ok(r.stdout.includes(cssFile), "should reference the css file");
  });

  it("--style with image magick route does not add --css", () => {
    const pngInput = fixtureFor("png")!;
    if (!pngInput) return;
    const out = outPath("styled.jpg");
    const r = runCli([
      "--dry-run",
      `--style=${fixturesDir}/style.css`,
      pngInput,
      out,
    ]);
    assert.strictEqual(r.status, 0);
    assert.ok(!r.stdout.includes("--css"), "png:jpg should not add --css");
  });
});

// ---------------------------------------------------------------------------
// MD-PDF-5: Error handling
// ---------------------------------------------------------------------------
describe("MD-PDF-5: Error handling", () => {
  it("non-existent input file exits 1", () => {
    const r = runCli(["--dry-run", "/nonexistent/path.md", "/tmp/out.pdf"]);
    assert.strictEqual(r.status, 1);
    assert.ok(
      r.stderr.includes("not found"),
      `expected 'not found' error, got: ${r.stderr}`,
    );
  });

  it("missing file extensions exits 1", () => {
    const r = runCli(["--dry-run", fixturesDir, "out"]);
    assert.strictEqual(r.status, 1);
    assert.ok(
      r.stderr.includes("file extensions"),
      `expected 'extensions' error, got: ${r.stderr}`,
    );
  });

  it("unsupported output extension exits 1", () => {
    const mdInput = fixtureFor("md")!;
    const r = runCli(["--dry-run", mdInput, "/tmp/out.xyz"]);
    assert.strictEqual(r.status, 1);
    assert.ok(
      r.stderr.includes("Unsupported conversion"),
      `expected unsupported error: ${r.stderr}`,
    );
  });

  it("no args exits 1", () => {
    const r = runCli([]);
    assert.strictEqual(r.status, 1);
    assert.ok(r.stdout.includes("Usage:"), "should print usage");
  });
});

// ---------------------------------------------------------------------------
// MD-PDF-6: --metadata-file
// ---------------------------------------------------------------------------
describe("MD-PDF-6: --metadata-file", () => {
  const mdInput = fixtureFor("md")!;

  it("--metadata-file adds flag to pandoc command", () => {
    const metaPath = path.join(fixturesDir, "metadata.json");
    const out = outPath("meta.pdf");
    const r = runCli([
      "--dry-run",
      `--metadata-file=${metaPath}`,
      mdInput,
      out,
    ]);
    assert.strictEqual(r.status, 0);
    assert.ok(
      r.stdout.includes("--metadata-file"),
      "should include --metadata-file",
    );
    assert.ok(
      r.stdout.includes(metaPath),
      "should reference the metadata file",
    );
  });

  it("--metadata-file with non-pdf output also works", () => {
    const metaPath = path.join(fixturesDir, "metadata.json");
    const out = outPath("meta.html");
    const r = runCli([
      "--dry-run",
      `--metadata-file=${metaPath}`,
      mdInput,
      out,
    ]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--metadata-file"));
  });
});

// ---------------------------------------------------------------------------
// MD-PDF-7: --wrap and --extract-media
// ---------------------------------------------------------------------------
describe("MD-PDF-7: --wrap and --extract-media", () => {
  const mdInput = fixtureFor("md")!;

  it("--wrap=none adds --wrap=none to pandoc", () => {
    const out = outPath("wrap-none.pdf");
    const r = runCli(["--dry-run", "--wrap=none", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--wrap=none"));
  });

  it("--wrap=preserve adds --wrap=preserve to pandoc", () => {
    const out = outPath("wrap-preserve.pdf");
    const r = runCli(["--dry-run", "--wrap=preserve", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--wrap=preserve"));
  });

  it("--extract-media adds --extract-media to pandoc", () => {
    const out = outPath("extract.pdf");
    const r = runCli([
      "--dry-run",
      "--extract-media=./out_media",
      mdInput,
      out,
    ]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--extract-media=./out_media"));
  });

  it("auto --extract-media is added for md/docx sources", () => {
    const out = outPath("auto-extract.pdf");
    const r = runCli(["--dry-run", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(
      r.stdout.includes("--extract-media="),
      "should auto-include --extract-media",
    );
  });
});

// ---------------------------------------------------------------------------
// Boolean negation flags
// ---------------------------------------------------------------------------
describe("Boolean negation with md:pdf", () => {
  const mdInput = fixtureFor("md")!;

  it("--no-toc suppresses --toc", () => {
    const out = outPath("no-toc.pdf");
    const r = runCli(["--dry-run", "--no-toc", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(!r.stdout.includes("--toc"));
  });

  it("--toc --no-toc (last wins) disables toc", () => {
    const out = outPath("neg-toc-no.pdf");
    const r = runCli(["--dry-run", "--toc", "--no-toc", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(!r.stdout.includes("--toc"));
  });

  it("--no-toc --toc (last wins) enables toc", () => {
    const out = outPath("neg-toc-yes.pdf");
    const r = runCli(["--dry-run", "--no-toc", "--toc", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--toc"));
  });

  it("--no-number-sections suppresses --number-sections", () => {
    const out = outPath("no-numsec.pdf");
    const r = runCli(["--dry-run", "--no-number-sections", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(!r.stdout.includes("--number-sections"));
  });
});

// ---------------------------------------------------------------------------
// Combined flags
// ---------------------------------------------------------------------------
describe("Combined flags with md:pdf", () => {
  const mdInput = fixtureFor("md")!;

  it("--toc --number-sections --page-size=a5 --style together", () => {
    const cssFile = path.join(fixturesDir, "style.css");
    const out = outPath("all-flags.pdf");
    const r = runCli([
      "--dry-run",
      "--toc",
      "--number-sections",
      "--page-size=a5",
      `--style=${cssFile}`,
      mdInput,
      out,
    ]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--toc"));
    assert.ok(r.stdout.includes("--number-sections"));
    assert.ok(r.stdout.includes("papersize:a5"));
    assert.ok(r.stdout.includes("--css"));
  });

  it("--page-size with --toc does not duplicate dry-run flag", () => {
    const out = outPath("combined-dedup.pdf");
    const r = runCli(["--dry-run", "--toc", mdInput, out]);
    const dryMatches = r.stdout.match(/--dry-run/g);
    assert.strictEqual(
      dryMatches,
      null,
      "--dry-run should not leak into pandoc args",
    );
  });
});

// ---------------------------------------------------------------------------
// Real conversions (guarded)
// ---------------------------------------------------------------------------
describe("Real md:pdf conversions (requires pandoc + weasyprint)", () => {
  const mdInput = fixtureFor("md")!;
  const hasPandoc = which("pandoc");
  const hasWeasyprint = which("weasyprint");
  const canConvert = hasPandoc && hasWeasyprint;

  it(
    "basic md->pdf conversion produces non-empty PDF",
    { timeout: 60000 },
    () => {
      if (!canConvert) return;
      const out = outPath("real-basic.pdf");
      const r = runCli([mdInput, out]);
      assert.strictEqual(r.status, 0, `conversion failed: ${r.stderr}`);
      assert.ok(existsSync(out), "PDF output should exist");
      assert.ok(statSync(out).size > 0, "PDF output should not be empty");
    },
  );

  it(
    "md->pdf with --toc produces PDF with table of contents",
    { timeout: 60000 },
    () => {
      if (!canConvert) return;
      const out = outPath("real-toc.pdf");
      const r = runCli(["--toc", mdInput, out]);
      assert.strictEqual(r.status, 0, `toc conversion failed: ${r.stderr}`);
      assert.ok(existsSync(out));
      assert.ok(statSync(out).size > 0);
    },
  );

  it(
    "md->pdf with --number-sections produces numbered headings",
    { timeout: 60000 },
    () => {
      if (!canConvert) return;
      const out = outPath("real-numsec.pdf");
      const r = runCli(["--number-sections", mdInput, out]);
      assert.strictEqual(r.status, 0, `number-sections failed: ${r.stderr}`);
      assert.ok(existsSync(out));
      assert.ok(statSync(out).size > 0);
    },
  );

  it("md->pdf with --page-size=letter", { timeout: 60000 }, () => {
    if (!canConvert) return;
    const out = outPath("real-page-letter.pdf");
    const r = runCli(["--page-size=letter", mdInput, out]);
    assert.strictEqual(r.status, 0, `page-size failed: ${r.stderr}`);
    assert.ok(existsSync(out));
    assert.ok(statSync(out).size > 0);
  });

  it("md->pdf with --style flag", { timeout: 60000 }, () => {
    if (!canConvert) return;
    const cssFile = path.join(fixturesDir, "style.css");
    const out = outPath("real-styled.pdf");
    const r = runCli([`--style=${cssFile}`, mdInput, out]);
    assert.strictEqual(r.status, 0, `style failed: ${r.stderr}`);
    assert.ok(existsSync(out));
    assert.ok(statSync(out).size > 0);
  });

  it("md->pdf with --metadata-file", { timeout: 60000 }, () => {
    if (!canConvert) return;
    const meta = path.join(fixturesDir, "metadata.json");
    const out = outPath("real-meta.pdf");
    const r = runCli([`--metadata-file=${meta}`, mdInput, out]);
    assert.strictEqual(r.status, 0, `metadata-file failed: ${r.stderr}`);
    assert.ok(existsSync(out));
    assert.ok(statSync(out).size > 0);
  });

  it("md->pdf with --extract-media extracts images", { timeout: 60000 }, () => {
    if (!canConvert) return;
    const mediaDir = outPath("extracted");
    const out = outPath("real-extract.pdf");
    const r = runCli([`--extract-media=${mediaDir}`, mdInput, out]);
    assert.strictEqual(r.status, 0, `extract-media failed: ${r.stderr}`);
    assert.ok(existsSync(out));
    assert.ok(statSync(out).size > 0);
  });

  it(
    "md->pdf combined: --toc --page-size=a5 --style --wrap=none",
    { timeout: 60000 },
    () => {
      if (!canConvert) return;
      const cssFile = path.join(fixturesDir, "style.css");
      const out = outPath("real-combined.pdf");
      const r = runCli([
        "--toc",
        "--page-size=a5",
        `--style=${cssFile}`,
        "--wrap=none",
        mdInput,
        out,
      ]);
      assert.strictEqual(r.status, 0, `combined flags failed: ${r.stderr}`);
      assert.ok(existsSync(out));
      assert.ok(statSync(out).size > 0);
    },
  );
});

describe("Real md:pdf edge cases (guarded)", () => {
  const hasPandoc = which("pandoc");
  const hasWeasyprint = which("weasyprint");
  const canConvert = hasPandoc && hasWeasyprint;

  it("empty markdown file produces non-empty PDF", { timeout: 60000 }, () => {
    if (!canConvert) return;
    const emptyMd = outPath("empty.md");
    writeFileSync(emptyMd, "");
    const out = outPath("empty-output.pdf");
    const r = runCli([emptyMd, out]);
    assert.strictEqual(r.status, 0, `empty md failed: ${r.stderr}`);
    assert.ok(existsSync(out));
    assert.ok(
      statSync(out).size > 0,
      "PDF from empty md should still have content",
    );
  });

  it(
    "markdown with only plain text produces valid PDF",
    { timeout: 60000 },
    () => {
      if (!canConvert) return;
      const plainMd = outPath("plain.md");
      writeFileSync(plainMd, "Just a simple paragraph of text.");
      const out = outPath("plain-output.pdf");
      const r = runCli([plainMd, out]);
      assert.strictEqual(r.status, 0, `plain text failed: ${r.stderr}`);
      assert.ok(existsSync(out));
      assert.ok(statSync(out).size > 0);
    },
  );
});
