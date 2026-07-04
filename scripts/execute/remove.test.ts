import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateFlags } from "./remove.ts";

it("validateFlags - accepts valid flags", () => {
  validateFlags(new Set(["-r", "-n"]));
});

it("validateFlags - accepts all valid flags together", () => {
  validateFlags(
    new Set([
      "-r",
      "--recursive",
      "-n",
      "--dry-run",
      "-e",
      "--remove-empty-dirs",
    ]),
  );
});

it("validateFlags - accepts empty set", () => {
  validateFlags(new Set());
});
