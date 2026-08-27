import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { sanitizeImagePaths } from "./index.ts";

describe("sanitizeImagePaths", () => {
  it("replaces spaces in image paths and renames files", async () => {
    const tmp = mkdtempSync("/tmp/cv-test-");
    const mdPath = path.join(tmp, "out.md");
    const mediaDir = path.join(tmp, "out_media");
    mkdirSync(mediaDir, { recursive: true });

    const oldImage = path.join(mediaDir, "my image.png");
    writeFileSync(oldImage, "fake-png");
    writeFileSync(mdPath, "![](out_media/my image.png)");

    await sanitizeImagePaths(mdPath, mediaDir, false);

    const updated = readFileSync(mdPath, "utf-8");
    assert.strictEqual(updated, "![](out_media/my-image.png)");
    assert.ok(!existsSync(oldImage));
    assert.ok(existsSync(path.join(mediaDir, "my-image.png")));
  });

  it("skips non-md output", async () => {
    const tmp = mkdtempSync("/tmp/cv-test-");
    const htmlPath = path.join(tmp, "out.html");
    writeFileSync(htmlPath, "![](dir/image name.png)");

    await sanitizeImagePaths(htmlPath, "dir", false);

    assert.strictEqual(
      readFileSync(htmlPath, "utf-8"),
      "![](dir/image name.png)",
    );
  });

  it("does not touch paths without spaces", async () => {
    const tmp = mkdtempSync("/tmp/cv-test-");
    const mdPath = path.join(tmp, "out.md");
    const mediaDir = path.join(tmp, "out_media");
    mkdirSync(mediaDir, { recursive: true });
    writeFileSync(path.join(mediaDir, "img.png"), "fake");
    writeFileSync(mdPath, "![](out_media/img.png)");

    await sanitizeImagePaths(mdPath, mediaDir, false);

    assert.strictEqual(readFileSync(mdPath, "utf-8"), "![](out_media/img.png)");
  });

  it("handles multiple images with spaces", async () => {
    const tmp = mkdtempSync("/tmp/cv-test-");
    const mdPath = path.join(tmp, "out.md");
    const mediaDir = path.join(tmp, "out_media");
    mkdirSync(mediaDir, { recursive: true });
    writeFileSync(path.join(mediaDir, "a b.png"), "fake1");
    writeFileSync(path.join(mediaDir, "c d.png"), "fake2");
    writeFileSync(mdPath, "![](out_media/a b.png) ![](out_media/c d.png)");

    await sanitizeImagePaths(mdPath, mediaDir, false);

    const updated = readFileSync(mdPath, "utf-8");
    assert.strictEqual(
      updated,
      "![](out_media/a-b.png) ![](out_media/c-d.png)",
    );
  });

  it("respects dryRun", async () => {
    const tmp = mkdtempSync("/tmp/cv-test-");
    const mdPath = path.join(tmp, "out.md");
    const mediaDir = path.join(tmp, "out_media");
    mkdirSync(mediaDir, { recursive: true });
    const oldImage = path.join(mediaDir, "my image.png");
    writeFileSync(oldImage, "fake-png");
    writeFileSync(mdPath, "![](out_media/my image.png)");

    await sanitizeImagePaths(mdPath, mediaDir, true);

    assert.strictEqual(
      readFileSync(mdPath, "utf-8"),
      "![](out_media/my image.png)",
    );
    assert.ok(existsSync(oldImage));
  });

  it("does nothing when mediaDir is null", async () => {
    const tmp = mkdtempSync("/tmp/cv-test-");
    const mdPath = path.join(tmp, "out.md");
    writeFileSync(mdPath, "![](out_media/my image.png)");

    await sanitizeImagePaths(mdPath, null, false);

    assert.strictEqual(
      readFileSync(mdPath, "utf-8"),
      "![](out_media/my image.png)",
    );
  });

  it("skips missing output file gracefully", async () => {
    await sanitizeImagePaths("/nonexistent/path.md", "/some/media", false);
  });
});
