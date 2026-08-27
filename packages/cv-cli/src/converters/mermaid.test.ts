import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { hasMermaidBlocks, tryPreprocessMermaid } from "./mermaid.ts";

describe("hasMermaidBlocks", () => {
  it("detects fenced mermaid code blocks", () => {
    assert.ok(hasMermaidBlocks("```mermaid\nflowchart LR\nA-->B\n```"));
  });

  it("returns false for plain markdown", () => {
    assert.ok(!hasMermaidBlocks("# Hello\n\nThis is plain text."));
  });

  it("returns false for other code blocks", () => {
    assert.ok(!hasMermaidBlocks("```javascript\nconst x = 1;\n```"));
  });

  it("detects mermaid blocks with surrounding text", () => {
    const md = "# Diagram\n\n```mermaid\nflowchart LR\nA-->B\n```\n\nDone.";
    assert.ok(hasMermaidBlocks(md));
  });

  it("detects mermaid blocks at the start of content", () => {
    assert.ok(
      hasMermaidBlocks("```mermaid\nflowchart TD\nA[Start] --> B[End]\n```"),
    );
  });

  it("detects mermaid blocks with leading whitespace", () => {
    assert.ok(hasMermaidBlocks("  ```mermaid\ngraph\n  ```"));
  });

  it("returns false for info string that merely contains mermaid", () => {
    assert.ok(!hasMermaidBlocks("```mermaid-typescript\nconst x = 1;\n```"));
  });

  it("detects inline mermaid blocks (info string with extra words)", () => {
    assert.ok(hasMermaidBlocks("``` mermaid\nflowchart\n```"));
  });
});

describe("tryPreprocessMermaid", () => {
  it("returns unchanged content when no mermaid blocks exist", async () => {
    const result = await tryPreprocessMermaid("# No diagrams", {
      dryRun: false,
    });
    assert.strictEqual(result, "# No diagrams");
  });

  it("returns unchanged content when dryRun is true", async () => {
    const result = await tryPreprocessMermaid("```mermaid\nflowchart\n```", {
      dryRun: true,
    });
    assert.strictEqual(result, "```mermaid\nflowchart\n```");
  });

  it("returns unchanged content when mmdr is not available on PATH", async () => {
    const origPath = process.env.PATH;
    process.env.PATH = "/dev/null";
    try {
      const result = await tryPreprocessMermaid("```mermaid\nflowchart\n```", {
        dryRun: false,
      });
      assert.strictEqual(result, "```mermaid\nflowchart\n```");
    } finally {
      process.env.PATH = origPath;
    }
  });

  it(
    "replaces mermaid block with data URI when mmdr is available",
    { timeout: 30000 },
    async () => {
      const { spawnSync } = await import("node:child_process");
      const which = spawnSync("which", ["mmdr"]);
      if (which.status !== 0) {
        console.warn("Skipping: mmdr not found on PATH");
        return;
      }

      const tmpDir = mkdtempSync(path.join(tmpdir(), "cv-mermaid-test-"));
      try {
        const md =
          "# Diagram\n\n```mermaid\nflowchart LR\n  A[Start] --> B[End]\n```\n\nDone.";
        const result = await tryPreprocessMermaid(md, { dryRun: false });

        assert.ok(
          result.includes("![](data:image/png;base64,"),
          `Expected PNG data URI, got: ${result.slice(0, 200)}`,
        );
        assert.ok(result.includes("Done."));
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    },
  );
});

describe("input.md fixture has mermaid blocks", () => {
  it("detects mermaid in test/fixtures/input.md", () => {
    const content = readFileSync("test/fixtures/input.md", "utf-8");
    assert.ok(hasMermaidBlocks(content));
  });
});
