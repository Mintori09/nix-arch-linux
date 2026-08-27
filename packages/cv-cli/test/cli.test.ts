import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTES } from "../src/routes.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const cliEntry = path.resolve(rootDir, "src/index.ts");
const fixturesDir = path.resolve(rootDir, "test/fixtures");

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

function fixtureFor(ext: string): string | null {
  const p = path.join(fixturesDir, `input.${ext}`);
  return existsSync(p) ? p : null;
}

function outputFor(route: string, outExt: string): string {
  return path.join(
    fixturesDir,
    "output",
    `${route.replace(":", "-")}.${outExt}`,
  );
}

before(() => {
  const xlsxPath = path.join(fixturesDir, "input.xlsx");
  if (existsSync(xlsxPath)) return;
  const csvPath = path.join(fixturesDir, "input.csv");
  if (!existsSync(csvPath)) return;
  spawnSync(
    "soffice",
    ["--headless", "--convert-to", "xlsx", "--outdir", fixturesDir, csvPath],
    { encoding: "utf-8" },
  );
});

describe("CLI basics", () => {
  it("--help prints usage and exits 0", () => {
    const r = runCli(["--help"]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("Usage:"));
  });

  it("-h prints usage and exits 0", () => {
    const r = runCli(["-h"]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("Usage:"));
  });

  it("--help does not show --profile", () => {
    const r = runCli(["--help"]);
    assert.ok(!r.stdout.includes("--profile"));
  });

  it("--list prints supported conversions", () => {
    const r = runCli(["--list"]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("Supported conversions:"));
  });

  it("no args prints usage and exits 1", () => {
    const r = runCli([]);
    assert.strictEqual(r.status, 1);
    assert.ok(r.stdout.includes("Usage:"));
    assert.ok(r.stderr.includes("required"));
  });

  it("missing input file exits 1", () => {
    const r = runCli(["--dry-run", "nonexistent.md", "out.html"]);
    assert.strictEqual(r.status, 1);
    assert.ok(r.stderr.includes("not found"));
  });

  it("missing file extensions exits 1", () => {
    const r = runCli(["--dry-run", fixturesDir, "out"]);
    assert.strictEqual(r.status, 1);
    assert.ok(r.stderr.includes("file extensions"));
  });

  it("unsupported route exits 1", () => {
    const input = fixtureFor("md")!;
    const r = runCli(["--dry-run", input, "out.xyz"]);
    assert.strictEqual(r.status, 1);
    assert.ok(r.stderr.includes("Unsupported conversion"));
  });
});

describe("all format pairs with --dry-run", () => {
  for (const [route] of Object.entries(ROUTES)) {
    const [inExt, outExt] = route.split(":");
    const inputPath = fixtureFor(inExt);
    if (!inputPath) {
      it.skip(`${route} (no fixture for .${inExt})`, () => {});
      continue;
    }
    const outputPath = outputFor(route, outExt);
    it(`converts ${route}`, () => {
      const r = runCli(["--dry-run", inputPath, outputPath]);
      assert.strictEqual(
        r.status,
        0,
        `${route} status=${r.status} stderr=${r.stderr}`,
      );
      assert.ok(
        r.stdout.includes("Conversion successful"),
        `${route} missing success`,
      );
      assert.ok(r.stdout.includes("(dry-run)"), `${route} not dry-run`);
    });
  }
});

describe("pandoc flag forwarding", () => {
  const mdInput = fixtureFor("md")!;

  it("--toc with md:html", () => {
    const out = path.join(fixturesDir, "output", "flag-toc.html");
    const r = runCli(["--dry-run", "--toc", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--toc"));
  });

  it("--number-sections with md:html", () => {
    const out = path.join(fixturesDir, "output", "flag-numsections.html");
    const r = runCli(["--dry-run", "--number-sections", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--number-sections"));
  });

  it("--wrap=none with md:html", () => {
    const out = path.join(fixturesDir, "output", "flag-wrap-none.html");
    const r = runCli(["--dry-run", "--wrap=none", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--wrap=none"));
  });

  it("--wrap=preserve with md:html", () => {
    const out = path.join(fixturesDir, "output", "flag-wrap-preserve.html");
    const r = runCli(["--dry-run", "--wrap=preserve", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--wrap=preserve"));
  });

  it("--metadata-file with md:html", () => {
    const meta = path.join(fixturesDir, "metadata.json");
    const out = path.join(fixturesDir, "output", "flag-meta.html");
    const r = runCli(["--dry-run", `--metadata-file=${meta}`, mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--metadata-file"));
  });

  it("--reference-doc with md:docx", () => {
    const ref = path.join(fixturesDir, "input.docx");
    const out = path.join(fixturesDir, "output", "flag-ref.docx");
    const r = runCli(["--dry-run", `--reference-doc=${ref}`, mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--reference-doc"));
  });

  it("--extract-media with md:html", () => {
    const out = path.join(fixturesDir, "output", "flag-extract.html");
    const r = runCli(["--dry-run", "--extract-media=./media", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--extract-media=./media"));
  });

  it("auto --extract-media for md/docx sources", () => {
    const out = path.join(fixturesDir, "output", "flag-auto-extract.html");
    const r = runCli(["--dry-run", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--extract-media="));
  });

  it("combined --toc --number-sections --wrap=preserve", () => {
    const out = path.join(fixturesDir, "output", "flag-combined.html");
    const r = runCli([
      "--dry-run",
      "--toc",
      "--number-sections",
      "--wrap=preserve",
      mdInput,
      out,
    ]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--toc"));
    assert.ok(r.stdout.includes("--number-sections"));
    assert.ok(r.stdout.includes("--wrap=preserve"));
  });

  it("--style adds --css for pandoc md:html route", () => {
    const out = path.join(fixturesDir, "output", "flag-style.html");
    const stylePath = path.join(fixturesDir, "input.css");
    const r = runCli(["--dry-run", `--style=${stylePath}`, mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--css"));
    assert.ok(r.stdout.includes(stylePath));
  });

  it("--style adds --css for pandoc md:pdf route", () => {
    const out = path.join(fixturesDir, "output", "flag-style.pdf");
    const cssFile = path.join(fixturesDir, "input.css");
    const r = runCli(["--dry-run", `--style=${cssFile}`, mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--css"));
    assert.ok(r.stdout.includes(cssFile));
  });

  it("--style does not add --css for non-pandoc png:jpg route", () => {
    const pngInput = fixtureFor("png")!;
    const out = path.join(fixturesDir, "output", "flag-style-style.jpg");
    const cssFile = path.join(fixturesDir, "input.css");
    const r = runCli(["--dry-run", `--style=${cssFile}`, pngInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(!r.stdout.includes("--css"));
  });

  it("forwards arbitrary passthrough flags to the underlying tool", () => {
    const out = path.join(fixturesDir, "output", "flag-passthrough.html");
    const r = runCli([
      "--dry-run",
      mdInput,
      out,
      "--standalone",
      "--custom-flag",
      "custom-val",
    ]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--standalone"), "Should include --standalone");
    assert.ok(
      r.stdout.includes("--custom-flag"),
      "Should include --custom-flag",
    );
    assert.ok(r.stdout.includes("custom-val"), "Should include custom-val");
  });
});

describe("boolean negation flags", () => {
  const mdInput = fixtureFor("md")!;

  it("--no-toc suppresses --toc for md:html", () => {
    const out = path.join(fixturesDir, "output", "neg-no-toc.html");
    const r = runCli(["--dry-run", "--no-toc", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(!r.stdout.includes("--toc"));
  });

  it("--no-number-sections suppresses --number-sections for md:html", () => {
    const out = path.join(fixturesDir, "output", "neg-no-number-sections.html");
    const r = runCli(["--dry-run", "--no-number-sections", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(!r.stdout.includes("--number-sections"));
  });

  it("--toc --no-toc (last wins) disables toc", () => {
    const out = path.join(fixturesDir, "output", "neg-toc-last-no.html");
    const r = runCli(["--dry-run", "--toc", "--no-toc", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(!r.stdout.includes("--toc"));
  });

  it("--no-toc --toc (last wins) enables toc", () => {
    const out = path.join(fixturesDir, "output", "neg-toc-last-yes.html");
    const r = runCli(["--dry-run", "--no-toc", "--toc", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("--toc"));
  });
});

describe("mermaid integration", () => {
  it("mermaid preprocessing triggered for .md input", () => {
    const mdInput = fixtureFor("md")!;
    const out = path.join(fixturesDir, "output", "mermaid-test.html");
    const r = runCli(["--dry-run", mdInput, out]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("pandoc"));
  });
});

describe("epub:md metadata and cover extraction", () => {
  const epubInput = fixtureFor("epub")!;
  const outMd = path.join(fixturesDir, "output", "epub-enhanced-test.md");

  it("runs unzip -p for container.xml on --dry-run", () => {
    const r = runCli(["--dry-run", epubInput, outMd]);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes("unzip"), "should log unzip commands");
    assert.ok(
      r.stdout.includes("META-INF/container.xml"),
      "should parse container.xml",
    );
    assert.ok(r.stdout.includes("pandoc"), "should run pandoc");
  });

  it("outputs metadata JSON and cover alongside md file", async () => {
    const testEpub = path.join(fixturesDir, "input-test.epub");
    const outMd2 = path.join(fixturesDir, "output", "epub-real-test.md");
    const metaJson = outMd2.replace(/\.md$/, "-metadata.json");
    const coverJpg = outMd2.replace(/\.md$/, "-cover.jpg");
    const coverPng = outMd2.replace(/\.md$/, "-cover.png");

    for (const f of [outMd2, metaJson, coverJpg, coverPng]) {
      try {
        rmSync(f);
      } catch {
        /* ok */
      }
    }

    const r = runCli([testEpub, outMd2]);
    assert.strictEqual(r.status, 0, `status=${r.status} stderr=${r.stderr}`);

    assert.ok(existsSync(metaJson), "metadata JSON should exist");
    const meta = JSON.parse(readFileSync(metaJson, "utf-8"));
    assert.ok(typeof meta.title === "string", "title should be a string");
    assert.strictEqual(meta.author, "Test Author");
    assert.ok(meta.isbn, "isbn should exist");

    const coverExists = existsSync(coverJpg) || existsSync(coverPng);
    assert.ok(coverExists, "cover should exist");

    assert.ok(existsSync(outMd2), "markdown output should exist");

    for (const f of [outMd2, metaJson, coverJpg, coverPng]) {
      try {
        rmSync(f);
      } catch {
        /* ok */
      }
    }
  });
});
