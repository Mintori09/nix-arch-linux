import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkExecutable,
  checkReadable,
  findCommandInPath,
  resolveRealPath,
} from "./which_file.ts";
import { join } from "node:path";
import { mkdtemp, writeFile, chmod } from "node:fs/promises";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";

it("resolveRealPath - resolves path for existing file", () => {
  const result = resolveRealPath("/bin/sh");
  assert.strictEqual(typeof result, "string");
  assert.strictEqual(result.length > 0, true);
});

it("resolveRealPath - returns input for non-existing path", () => {
  const result = resolveRealPath("/nonexistent/path");
  assert.strictEqual(result, "/nonexistent/path");
});

it("findCommandInPath - finds existing command in PATH", () => {
  const result = findCommandInPath("sh");
  assert.strictEqual(typeof result, "string");
  assert.strictEqual((result as string).endsWith("/sh"), true);
});

it("findCommandInPath - returns null for non-existing command", () => {
  const result = findCommandInPath("thiscmdshouldnotexistxyz123");
  assert.strictEqual(result, null);
});

it("findCommandInPath - accepts relative path if file exists", () => {
  const result = findCommandInPath("/bin/sh");
  assert.strictEqual(result, "/bin/sh");
});

it("checkExecutable - returns true for executable files", () => {
  assert.strictEqual(checkExecutable("/bin/sh"), true);
});

it("checkExecutable - returns false for non-existing path", () => {
  assert.strictEqual(checkExecutable("/nonexistent"), false);
});

it("checkExecutable - returns false for non-executable file", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "which-file-test-"));
  const filePath = join(tempDir, "test.txt");
  try {
    await writeFile(filePath, "hello");
    assert.strictEqual(checkExecutable(filePath), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

it("checkExecutable - returns true after chmod +x", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "which-file-test-"));
  const filePath = join(tempDir, "script.sh");
  try {
    await writeFile(filePath, "#!/bin/sh\necho hello");
    await chmod(filePath, 0o755);
    assert.strictEqual(checkExecutable(filePath), true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

it("checkReadable - returns true for existing file", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "which-file-test-"));
  const filePath = join(tempDir, "readable.txt");
  try {
    await writeFile(filePath, "hello");
    assert.strictEqual(checkReadable(filePath), true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

it("checkReadable - returns false for non-existing path", () => {
  assert.strictEqual(checkReadable("/nonexistent"), false);
});
