import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  hasRemoteImages,
  preprocessRemoteImages,
} from "./remote-images.ts";

describe("remote-images preprocessor", () => {
  it("detects remote images correctly", () => {
    assert.strictEqual(
      hasRemoteImages("![test](https://example.com/img.png)"),
      true,
    );
    assert.strictEqual(
      hasRemoteImages("![test](http://example.com/img.jpg)"),
      true,
    );
    assert.strictEqual(
      hasRemoteImages("![test](./local.png)"),
      false,
    );
    assert.strictEqual(hasRemoteImages("No images here"), false);
  });

  it("handles empty and plain content without modification", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "cv-test-img-"));
    try {
      const content = "Hello world\n\nNo images here";
      const res = await preprocessRemoteImages(content, tmp);
      assert.strictEqual(res, content);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("downloads remote image and replaces url with local path", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "cv-test-img-"));
    try {
      const content =
        "Title\n\n![Dummy](https://dummyimage.com/10x10/000/fff.png)\n";
      const res = await preprocessRemoteImages(content, tmp);
      assert.notStrictEqual(res, content);
      assert.ok(res.includes("![Dummy]("));
      assert.ok(!res.includes("https://dummyimage.com"));
      assert.ok(res.includes(tmp));
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
