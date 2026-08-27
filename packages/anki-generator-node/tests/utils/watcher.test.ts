import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { watchFiles } from "../../src/utils/watcher.js";

describe("File Watcher", () => {
  test("debounces rapid file write events", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "anki-test-watch-"));
    const tmpFile = path.join(tmpDir, "test.json");
    fs.writeFileSync(tmpFile, "{}");

    let callCount = 0;
    const watcher = watchFiles(
      [tmpFile],
      () => {
        callCount++;
      },
      50,
    );

    // Rapid writes
    fs.writeFileSync(tmpFile, '{"a":1}');
    fs.writeFileSync(tmpFile, '{"a":2}');
    fs.writeFileSync(tmpFile, '{"a":3}');

    await new Promise((resolve) => setTimeout(resolve, 150));

    watcher.stop();
    fs.rmSync(tmpDir, { recursive: true, force: true });

    assert.strictEqual(callCount, 1);
  });
});
