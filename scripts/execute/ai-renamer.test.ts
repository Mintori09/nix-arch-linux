import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseArgs,
  sanitizeFilename,
  buildGeminiPrompt,
  resolveCollisions,
  FileItem,
} from "./ai-renamer.ts";

describe("ai-renamer test suite", () => {
  it("parseArgs - parses flags and targets correctly", () => {
    const opts = parseArgs([
      "-p",
      "kebab-case format",
      "-n",
      "-y",
      "-r",
      "-m",
      "gemini-2.5-flash",
      "--case",
      "kebab",
      "--no-content",
      "file1.txt",
      "file2.png",
    ]);

    assert.strictEqual(opts.prompt, "kebab-case format");
    assert.strictEqual(opts.dryRun, true);
    assert.strictEqual(opts.yes, true);
    assert.strictEqual(opts.recursive, true);
    assert.strictEqual(opts.model, "gemini-2.5-flash");
    assert.strictEqual(opts.caseStyle, "kebab");
    assert.strictEqual(opts.includeContent, false);
    assert.deepEqual(opts.targets, ["file1.txt", "file2.png"]);
  });

  it("parseArgs - defaults are sensible", () => {
    const opts = parseArgs(["my_file.pdf"]);
    assert.strictEqual(opts.dryRun, false);
    assert.strictEqual(opts.yes, false);
    assert.strictEqual(opts.recursive, false);
    assert.strictEqual(opts.includeContent, true);
    assert.deepEqual(opts.targets, ["my_file.pdf"]);
  });

  it("sanitizeFilename - removes forbidden characters", () => {
    assert.strictEqual(
      sanitizeFilename("invalid/name:with?chars*.txt"),
      "invalidnamewithchars.txt",
    );
    assert.strictEqual(
      sanitizeFilename("test<file>|name.doc..."),
      "testfilename.doc",
    );
    assert.strictEqual(
      sanitizeFilename("  spaced name.png  "),
      "spaced name.png",
    );
  });

  it("buildGeminiPrompt - generates structured prompt with custom hints", () => {
    const files: FileItem[] = [
      {
        path: "/tmp/doc1.txt",
        dir: "/tmp",
        originalName: "doc1.txt",
        extension: ".txt",
        sizeBytes: 120,
        contentSnippet: "Meeting notes about Q3 roadmap",
      },
    ];

    const prompt = buildGeminiPrompt(files, "translate to vietnamese", "snake");
    assert.ok(prompt.includes("doc1.txt"));
    assert.ok(prompt.includes("Meeting notes about Q3 roadmap"));
    assert.ok(prompt.includes("translate to vietnamese"));
    assert.ok(prompt.includes("'snake' style"));
  });

  it("resolveCollisions - preserves extensions and handles name collisions", () => {
    const files: FileItem[] = [
      {
        path: "/tmp/messy1.png",
        dir: "/tmp",
        originalName: "messy1.png",
        extension: ".png",
        sizeBytes: 500,
      },
      {
        path: "/tmp/messy2.png",
        dir: "/tmp",
        originalName: "messy2.png",
        extension: ".png",
        sizeBytes: 600,
      },
    ];

    // Simulate AI giving the same suggested name (or missing extension)
    const aiSuggestions = [
      {
        originalName: "messy1.png",
        suggestedName: "screenshot-dashboard", // missing .png
        reason: "descriptive name",
      },
      {
        originalName: "messy2.png",
        suggestedName: "screenshot-dashboard.png", // identical name
        reason: "descriptive name 2",
      },
    ];

    const proposals = resolveCollisions(files, aiSuggestions);

    assert.strictEqual(proposals.length, 2);
    assert.strictEqual(proposals[0].suggestedName, "screenshot-dashboard.png");
    assert.strictEqual(proposals[0].changed, true);

    // Second file should have -1 disambiguation
    assert.strictEqual(
      proposals[1].suggestedName,
      "screenshot-dashboard-1.png",
    );
    assert.strictEqual(proposals[1].changed, true);
  });
});
