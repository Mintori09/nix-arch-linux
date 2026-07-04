import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getRuntimePkgs } from "./direnv-wrap.ts";

it("getRuntimePkgs - returns python3 for python", () => {
  assert.strictEqual(getRuntimePkgs("python"), "python3");
});

it("getRuntimePkgs - returns nodejs and bun for node", () => {
  assert.strictEqual(getRuntimePkgs("node"), "nodejs bun");
});

it("getRuntimePkgs - returns deno for deno", () => {
  assert.strictEqual(getRuntimePkgs("deno"), "deno");
});

it("getRuntimePkgs - returns go for go", () => {
  assert.strictEqual(getRuntimePkgs("go"), "go");
});

it("getRuntimePkgs - returns rustc and cargo for rust", () => {
  assert.strictEqual(getRuntimePkgs("rust"), "rustc cargo");
});

it("getRuntimePkgs - returns ruby for ruby", () => {
  assert.strictEqual(getRuntimePkgs("ruby"), "ruby");
});

it("getRuntimePkgs - returns jdk for java", () => {
  assert.strictEqual(getRuntimePkgs("java"), "jdk");
});

it("getRuntimePkgs - returns nix pkgs for qt", () => {
  assert.strictEqual(getRuntimePkgs("qt"), "qt5.qtbase cmake");
});

it("getRuntimePkgs - returns nix pkgs for gtk", () => {
  assert.strictEqual(getRuntimePkgs("gtk"), "gtk3 glib pkg-config");
});

it("getRuntimePkgs - returns nix pkgs for flutter", () => {
  assert.strictEqual(getRuntimePkgs("flutter"), "flutter dart");
});

it("getRuntimePkgs - falls back to nodejs for unknown language", () => {
  assert.strictEqual(
    (getRuntimePkgs as (lang: string) => string)("unknown"),
    "nodejs",
  );
});
