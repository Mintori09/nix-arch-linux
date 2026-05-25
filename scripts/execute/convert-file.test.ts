import { describe, it } from "node:test";
import assert from "node:assert";
import { dirname, join } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { calculateViewportSize } from "./convert-file";

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "convert-file.ts");

function runConvertFile(args: string[]) {
  const proc = spawnSync("tsx", [scriptPath, ...args], { encoding: "utf-8" });

  return { exitCode: proc.status, stdout: proc.stdout, stderr: proc.stderr };
}

describe("convert-file mhtml image routes", () => {
  it("sizes mhtml screenshots from full document content", () => {
    assert.deepStrictEqual(
      calculateViewportSize({
        width: 920.2,
        height: 1800.4,
      }),
      { width: 921, height: 1833 },
    );
  });

  it("lists mhtml to image conversions", () => {
    const result = runConvertFile(["--list"]);

    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes("- mhtml:png"));
    assert.ok(result.stdout.includes("- mhtml:jpg"));
    assert.ok(result.stdout.includes("- mhtml:webp"));
  });

  it("dry-runs mhtml to png through Chromium screenshot", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "convert-file-test-"));
    const input = join(tempDir, "page.mhtml");
    const output = join(tempDir, "page.png");

    try {
      await writeFile(input, "From: test\nContent-Type: text/html\n\nhello");

      const result = runConvertFile(["--dry-run", input, output]);

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes("chromium --headless"));
      assert.ok(result.stdout.includes("--remote-debugging-port=0"));
      assert.ok(!result.stdout.includes("--window-size=1280,720"));
      assert.ok(!result.stdout.includes(`--screenshot=${output}`));
      assert.ok(result.stdout.includes(`file://${input}`));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
