import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { calculateViewportSize } from "./convert-file.ts";

const scriptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "convert-file.ts",
);

function runConvertFile(args: string[]) {
  const proc = spawnSync("tsx", [scriptPath, ...args], { encoding: "utf-8" });

  return { exitCode: proc.status, stdout: proc.stdout, stderr: proc.stderr };
}

it(
  "convert-file mhtml image routes - sizes mhtml screenshots from full document content",
  () => {
    assert.deepEqual(
      calculateViewportSize({
        width: 920.2,
        height: 1800.4,
      }),
      { width: 921, height: 1833 },
    );
  },
);

it(
  "convert-file mhtml image routes - lists mhtml to image conversions",
  () => {
    const result = runConvertFile(["--list"]);

    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout.includes("- mhtml:png"), true);
    assert.strictEqual(result.stdout.includes("- mhtml:jpg"), true);
    assert.strictEqual(result.stdout.includes("- mhtml:webp"), true);
  },
);

it(
  "convert-file mhtml image routes - dry-runs mhtml to png through Chromium screenshot",
  async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "convert-file-test-"));
    const input = join(tempDir, "page.mhtml");
    const output = join(tempDir, "page.png");

    try {
      await writeFile(input, "From: test\nContent-Type: text/html\n\nhello");

      const result = runConvertFile(["--dry-run", input, output]);

      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(result.stdout.includes("chromium --headless"), true);
      assert.strictEqual(result.stdout.includes("--remote-debugging-port=0"), true);
      assert.strictEqual(result.stdout.includes("--window-size=1280,720"), false);
      assert.strictEqual(result.stdout.includes(`--screenshot=${output}`), false);
      assert.strictEqual(result.stdout.includes(`file://${input}`), true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  },
);

