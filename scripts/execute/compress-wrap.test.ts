import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectType, parseArgs, tempExtension } from "./compress-wrap.ts";

it("detectType - identifies .zip extension", () => {
  assert.strictEqual(detectType("archive.zip"), "zip");
});

it("detectType - identifies .tar extension", () => {
  assert.strictEqual(detectType("archive.tar"), "tar");
});

it("detectType - identifies .tar.gz extension", () => {
  assert.strictEqual(detectType("archive.tar.gz"), "tar.gz");
});

it("detectType - identifies .tgz shorthand", () => {
  assert.strictEqual(detectType("archive.tgz"), "tar.gz");
});

it("detectType - identifies .tar.bz2 extension", () => {
  assert.strictEqual(detectType("archive.tar.bz2"), "tar.bz2");
});

it("detectType - identifies .tbz2 shorthand", () => {
  assert.strictEqual(detectType("archive.tbz2"), "tar.bz2");
});

it("detectType - identifies .tar.xz extension", () => {
  assert.strictEqual(detectType("archive.tar.xz"), "tar.xz");
});

it("detectType - identifies .txz shorthand", () => {
  assert.strictEqual(detectType("archive.txz"), "tar.xz");
});

it("detectType - identifies .7z extension", () => {
  assert.strictEqual(detectType("archive.7z"), "7z");
});

it("detectType - identifies .gz extension", () => {
  assert.strictEqual(detectType("file.txt.gz"), "gz");
});

it("detectType - identifies .bz2 extension", () => {
  assert.strictEqual(detectType("file.txt.bz2"), "bz2");
});

it("detectType - identifies .xz extension", () => {
  assert.strictEqual(detectType("file.txt.xz"), "xz");
});

it("tempExtension - roundtrips for zip", () => {
  assert.strictEqual(tempExtension("zip"), ".zip");
});

it("tempExtension - roundtrips for tar.gz", () => {
  assert.strictEqual(tempExtension("tar.gz"), ".tar.gz");
});

it("tempExtension - roundtrips for 7z", () => {
  assert.strictEqual(tempExtension("7z"), ".7z");
});

it("tempExtension - roundtrips for gz", () => {
  assert.strictEqual(tempExtension("gz"), ".gz");
});

it("tempExtension - roundtrips for bz2", () => {
  assert.strictEqual(tempExtension("bz2"), ".bz2");
});

it("tempExtension - roundtrips for xz", () => {
  assert.strictEqual(tempExtension("xz"), ".xz");
});

it("parseArgs - parses output and inputs", () => {
  assert.deepEqual(parseArgs(["output.zip", "input1", "input2"]), {
    force: false,
    output: "output.zip",
    inputs: ["input1", "input2"],
  });
});

it("parseArgs - parses force flag", () => {
  assert.deepEqual(parseArgs(["-f", "output.zip", "input"]), {
    force: true,
    output: "output.zip",
    inputs: ["input"],
  });
});

it("parseArgs - parses long force flag", () => {
  assert.deepEqual(parseArgs(["--force", "output.zip", "input"]), {
    force: true,
    output: "output.zip",
    inputs: ["input"],
  });
});

it("parseArgs - handles -- separator", () => {
  assert.deepEqual(parseArgs(["--", "output.zip", "input"]), {
    force: false,
    output: "output.zip",
    inputs: ["input"],
  });
});
