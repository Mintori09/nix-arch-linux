import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { calculateViewportSize } from "./convert-file";

const scriptPath = join(import.meta.dir, "convert-file.ts");

async function runConvertFile(args: string[]) {
  const proc = Bun.spawn(["bun", scriptPath, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  return { exitCode, stdout, stderr };
}

describe("convert-file mhtml image routes", () => {
  test("sizes mhtml screenshots from full document content", () => {
    expect(
      calculateViewportSize({
        width: 920.2,
        height: 1800.4,
      }),
    ).toEqual({ width: 921, height: 1833 });
  });

  test("lists mhtml to image conversions", async () => {
    const result = await runConvertFile(["--list"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("- mhtml:png");
    expect(result.stdout).toContain("- mhtml:jpg");
    expect(result.stdout).toContain("- mhtml:webp");
  });

  test("dry-runs mhtml to png through Chromium screenshot", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "convert-file-test-"));
    const input = join(tempDir, "page.mhtml");
    const output = join(tempDir, "page.png");

    try {
      await writeFile(input, "From: test\nContent-Type: text/html\n\nhello");

      const result = await runConvertFile(["--dry-run", input, output]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("chromium --headless");
      expect(result.stdout).toContain("--remote-debugging-port=0");
      expect(result.stdout).not.toContain("--window-size=1280,720");
      expect(result.stdout).not.toContain(`--screenshot=${output}`);
      expect(result.stdout).toContain(`file://${input}`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
