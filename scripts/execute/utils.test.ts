import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSyncOutput, which } from "./utils.ts";

it("which - finds sh in PATH", () => {
  const result = which("sh");
  assert.strictEqual(typeof result, "string");
  assert.strictEqual((result as string).endsWith("/sh"), true);
});

it("which - returns null for non-existing command", () => {
  const result = which("thiscmdshouldnotexistxyz123");
  assert.strictEqual(result, null);
});

it("which - accepts absolute path directly", () => {
  const result = which("/bin/sh");
  assert.strictEqual(result, "/bin/sh");
});

it("which - returns null for non-existing absolute path", () => {
  const result = which("/nonexistent/binary");
  assert.strictEqual(result, null);
});

it("spawnSyncOutput - runs echo and captures stdout", () => {
  const result = spawnSyncOutput("echo", ["hello world"]);
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(result.stdout.trim(), "hello world");
});

it("spawnSyncOutput - captures stderr output", () => {
  const result = spawnSyncOutput("sh", ["-c", "echo error >&2"]);
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(result.stderr.trim(), "error");
});

it("spawnSyncOutput - returns non-zero exit code for failing command", () => {
  const result = spawnSyncOutput("sh", ["-c", "exit 42"]);
  assert.strictEqual(result.exitCode, 42);
});

it("spawnSyncOutput - runs command in specified working directory", () => {
  const result = spawnSyncOutput("pwd", [], { cwd: "/tmp" });
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(result.stdout.trim(), "/tmp");
});
