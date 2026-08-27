import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  writeFileSync,
  readFileSync,
  mkdtempSync,
  rmSync,
  mkdirSync,
  statSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { deflateSync } from "node:zlib";
import { ROUTES } from "../src/routes.ts";
import type { ToolName } from "../src/converters/index.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const cliEntry = path.resolve(rootDir, "src/index.ts");
const fixturesDir = path.resolve(rootDir, "test/fixtures");

const FIXTURES_READY = new Set<string>();
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

function fp(ext: string): string {
  return path.join(fixturesDir, `input.${ext}`);
}

function outPath(route: string, outExt: string): string {
  return path.join(tmpDir, `${route.replace(":", "-")}.${outExt}`);
}

function hasFixture(ext: string): boolean {
  return existsSync(fp(ext)) && statSync(fp(ext)).size > 0;
}

function toolSpawn(cmd: string, args: readonly string[]): boolean {
  return spawnSync(cmd, args, { encoding: "utf-8", cwd: rootDir }).status === 0;
}

function genViaCli(input: string, output: string): boolean {
  const r = spawnSync("node", ["--import", "tsx", cliEntry, input, output], {
    encoding: "utf-8",
    cwd: rootDir,
  });
  return r.status === 0 && existsSync(output) && statSync(output).size > 0;
}

const BINARY = [
  "png",
  "jpg",
  "gif",
  "webp",
  "tiff",
  "bmp",
  "heic",
  "icns",
  "svg",
  "wav",
  "mp3",
  "ogg",
  "flac",
  "m4a",
  "mp4",
  "mkv",
  "webm",
  "mov",
  "avi",
  "flv",
  "mhtml",
  "pdf",
  "docx",
  "epub",
  "odt",
  "xlsx",
  "pptx",
  "odp",
  "ods",
  "doc",
  "xls",
  "ppt",
];

before(() => {
  for (const e of BINARY) {
    const p = fp(e);
    if (existsSync(p) && statSync(p).size < 10) rmSync(p);
  }

  const pngP = fp("png");
  if (which("magick")) {
    toolSpawn("magick", ["-size", "2x2", "xc:red", pngP]);
  }
  if (!hasFixture("png")) {
    const b64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAADklEQVR4nGNgYPgPAAEDAAQAkAGeGVrB5AAAAABJRU5ErkJggg==";
    writeFileSync(pngP, Buffer.from(b64, "base64"));
  }
  if (hasFixture("png")) FIXTURES_READY.add("png");

  if (which("ffmpeg")) {
    const wavP = fp("wav");
    if (!hasFixture("wav")) {
      toolSpawn("ffmpeg", [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=8000:cl=mono",
        "-t",
        "1",
        wavP,
      ]);
    }
  }
  if (hasFixture("wav")) FIXTURES_READY.add("wav");

  generateSvg();
  generateMhtml();

  const mdP = fp("md");
  const jsonP = fp("json");
  const yamlP = fp("yaml");
  const tomlP = fp("toml");
  const csvP = fp("csv");
  const xmlP = fp("xml");

  if (which("pandoc") && hasFixture("md")) {
    for (const t of ["docx", "epub", "odt", "html", "pdf"]) {
      if (
        toolSpawn("pandoc", ["--resource-path", fixturesDir, mdP, "-o", fp(t)])
      )
        FIXTURES_READY.add(t);
    }
  }

  if (which("magick") && FIXTURES_READY.has("png")) {
    for (const t of ["jpg", "gif", "webp", "tiff", "bmp"]) {
      if (toolSpawn("magick", [pngP, fp(t)])) FIXTURES_READY.add(t);
    }
  }

  if (FIXTURES_READY.has("png") && which("ffmpeg")) {
    const gifP = fp("gif");
    if (
      !FIXTURES_READY.has("gif") &&
      toolSpawn("ffmpeg", [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=2x2:d=1",
        "-vf",
        "fps=1",
        gifP,
      ])
    )
      FIXTURES_READY.add("gif");
  }

  if (FIXTURES_READY.has("wav") && which("ffmpeg")) {
    const wavP = fp("wav");
    for (const t of ["mp3", "ogg", "flac", "m4a"]) {
      if (toolSpawn("ffmpeg", ["-y", "-i", wavP, fp(t)])) FIXTURES_READY.add(t);
    }
  }

  if (FIXTURES_READY.has("wav") && which("ffmpeg")) {
    const mp4P = fp("mp4");
    if (!hasFixture("mp4")) {
      toolSpawn("ffmpeg", [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=2x2:d=1",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=8000:cl=mono",
        "-shortest",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        mp4P,
      ]);
    }
    if (hasFixture("mp4")) {
      FIXTURES_READY.add("mp4");
      for (const t of ["mkv", "webm", "mov", "avi", "flv"]) {
        if (genViaCli(mp4P, fp(t))) FIXTURES_READY.add(t);
      }
    }
  }

  if (which("soffice")) {
    const docxP = fp("docx");
    if (hasFixture(docxP)) {
      for (const t of ["odt", "odf", "pdf"]) {
        if (
          toolSpawn("soffice", [
            "--headless",
            "--convert-to",
            t,
            "--outdir",
            fixturesDir,
            docxP,
          ])
        )
          FIXTURES_READY.add(t);
      }
    }
  }

  if (which("yq") && hasFixture(jsonP)) {
    for (const t of ["yaml", "toml", "csv", "xml"]) {
      if (genViaCli(jsonP, fp(t))) FIXTURES_READY.add(t);
    }
  }

  if (which("soffice") && hasFixture("csv")) {
    toolSpawn("soffice", [
      "--headless",
      "--convert-to",
      "xlsx",
      "--outdir",
      fixturesDir,
      fp("csv"),
    ]);
  }
  if (hasFixture("xlsx")) FIXTURES_READY.add("xlsx");

  tmpDir = mkdtempSync(path.join(tmpdir(), "cv-real-test-"));
  mkdirSync(path.join(fixturesDir, "output"), { recursive: true });
});

function generateSvg(): void {
  const p = fp("svg");
  if (hasFixture("svg")) {
    FIXTURES_READY.add("svg");
    return;
  }
  writeFileSync(
    p,
    `<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2">` +
      `<rect width="2" height="2" fill="red"/></svg>`,
  );
  if (hasFixture("svg")) FIXTURES_READY.add("svg");
}

function generateMhtml(): void {
  const p = fp("mhtml");
  if (hasFixture("mhtml")) {
    FIXTURES_READY.add("mhtml");
    return;
  }
  const b = "----=_NextPart_001";
  writeFileSync(
    p,
    [
      "From: test",
      "Subject: test",
      "MIME-Version: 1.0",
      `Content-Type: multipart/related; boundary="${b}"`,
      "",
      `--${b}`,
      "Content-Type: text/html",
      "",
      "<html><body>hello</body></html>",
      `--${b}--`,
      "",
    ].join("\r\n"),
  );
  if (hasFixture("mhtml")) FIXTURES_READY.add("mhtml");
}

function fixtureForExt(ext: string): string | undefined {
  if (FIXTURES_READY.has(ext)) return fp(ext);
  if (existsSync(fp(ext)) && statSync(fp(ext)).size > 0) {
    FIXTURES_READY.add(ext);
    return fp(ext);
  }
  return undefined;
}

after(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("real conversions (no --dry-run)", () => {
  for (const [route] of Object.entries(ROUTES)) {
    const [inExt, outExt] = route.split(":");
    const inputPath = fixtureForExt(inExt);

    if (!inputPath) {
      it.skip(`${route} (no valid fixture for .${inExt})`, () => {});
      continue;
    }

    it(`converts ${route}`, () => {
      const tool: ToolName = ROUTES[route].tool;
      if (!which(tool)) {
        if (tool === "chromium" || tool === "xlsx2csv" || tool === "markitdown")
          return;
        throw new Error(`${tool} needed for ${route} but not in PATH`);
      }

      if (route === "json:csv") {
        const content = readFileSync(inputPath, "utf-8").trim();
        if (!content.startsWith("[")) return;
      }

      const out = outPath(route, outExt);
      const r = runCli([inputPath, out]);
      assert.strictEqual(r.status, 0, `${route} failed: ${r.stderr}`);

      let actualOutput = out;
      if (!existsSync(actualOutput) && tool === "pdftoppm") {
        const base = out.replace(/\.[^/.]+$/, "");
        const dir = path.dirname(base);
        const prefix = path.basename(base);
        const files = readdirSync(dir).filter(
          (f) => f.startsWith(prefix) && statSync(path.join(dir, f)).size > 0,
        );
        if (files.length > 0) actualOutput = path.join(dir, files[0]);
      }

      assert.ok(
        existsSync(actualOutput),
        `${route} output missing (looked for ${out})`,
      );
      assert.ok(statSync(actualOutput).size > 0, `${route} output is empty`);
    });
  }
});

describe("pandoc --extract-media", () => {
  it("extracts embedded images from docx to media directory", () => {
    const docxP = fixtureForExt("docx");
    if (!docxP || !which("pandoc")) return;

    const extractDir = path.join(tmpDir, "extracted-media");
    const outHtml = path.join(tmpDir, "extracted.html");
    const r = runCli([`--extract-media=${extractDir}`, docxP, outHtml]);
    assert.strictEqual(r.status, 0, `extract-media failed: ${r.stderr}`);

    assert.ok(existsSync(extractDir), "extract-media dir not created");
    const files = readdirSync(extractDir);
    assert.ok(files.length > 0, "extract-media dir is empty");

    const nonEmpty = files.filter(
      (f) => statSync(path.join(extractDir, f)).size > 0,
    );
    assert.ok(nonEmpty.length > 0, "all extracted files are empty");
  });

  it("sanitizes spaces in extracted image paths when converting docx to md", () => {
    const docxP = fixtureForExt("docx");
    if (!docxP || !which("pandoc")) return;

    const outMd = path.join(tmpDir, "extracted media.md");
    const r = runCli([docxP, outMd]);
    assert.strictEqual(r.status, 0, `docx:md failed: ${r.stderr}`);

    assert.ok(existsSync(outMd), "md output not created");
    const content = readFileSync(outMd, "utf-8");

    const imageRefs = content.match(/!\[.*?\]\([^)]+\)/g) ?? [];
    for (const ref of imageRefs) {
      const m = ref.match(/!\[.*?\]\(([^)]+)\)/);
      if (m) {
        assert.ok(!m[1].includes(" "), `Image path contains space: ${m[1]}`);
      }
    }

    const autoMediaDir = outMd.replace(/\.[^/.]+$/, "") + "_media";
    if (existsSync(autoMediaDir)) {
      const files = readdirSync(autoMediaDir);
      for (const f of files) {
        assert.ok(!f.includes(" "), `Media file contains space: ${f}`);
      }
    }
  });
});

describe("pandoc --style flag", () => {
  it("--style=test/fixtures/style.css adds --css to pandoc HTML output", () => {
    const mdP = fixtureForExt("md");
    if (!mdP || !which("pandoc")) return;

    const out = path.join(tmpDir, "style-test.html");
    const r = runCli([
      `--style=${path.join(fixturesDir, "style.css")}`,
      mdP,
      out,
    ]);
    assert.strictEqual(r.status, 0, `--style failed: ${r.stderr}`);

    assert.ok(existsSync(out), "HTML output not created");
    const content = readFileSync(out, "utf-8");
    assert.ok(
      content.includes("<h1") || content.includes("<p"),
      `Expected HTML content in output: ${content.slice(0, 100)}`,
    );
  });
});

describe("mermaid auto-detect", () => {
  it(
    "converts md with mermaid block to HTML (data URI)",
    { timeout: 60000 },
    () => {
      const mdP = fixtureForExt("md");
      if (!mdP || !which("pandoc")) return;

      if (!which("mmdr")) return;

      const out = path.join(tmpDir, "mermaid-test.html");
      const r = runCli([mdP, out]);
      assert.strictEqual(r.status, 0, `mermaid md:html failed: ${r.stderr}`);

      assert.ok(existsSync(out), "HTML output not created");
      const content = readFileSync(out, "utf-8");

      assert.ok(content.length > 0, "HTML output is empty");
      assert.ok(
        content.includes("<h1") || content.includes("<p"),
        `Expected HTML content in mermaid output, got first 500 chars:\n${content.slice(0, 500)}`,
      );
    },
  );

  it(
    "converts md with mermaid block to PDF successfully",
    { timeout: 60000 },
    () => {
      const mdP = fixtureForExt("md");
      if (!mdP || !which("pandoc") || !which("mmdr")) return;
      if (!which("weasyprint")) return;

      const out = path.join(tmpDir, "mermaid-test.pdf");
      const r = runCli([mdP, out]);
      assert.strictEqual(r.status, 0, `mermaid md:pdf failed: ${r.stderr}`);

      assert.ok(existsSync(out), "PDF output not created");
      assert.ok(statSync(out).size > 0, "PDF output is empty");
    },
  );
});
