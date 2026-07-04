import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_LARGE_TEXT_BYTES,
  buildOpenCommand,
  isProbablyTextPath,
  parseArgs,
  parseOpenConfig,
  planOpenTarget,
} from "./open.ts";

it("parseArgs - parses project mode with long and short flags", () => {
  assert.deepEqual(parseArgs(["--project", "."]), {
    projectMode: true,
    targets: ["."],
  });

  assert.deepEqual(parseArgs(["-p", "~/src/app"]), {
    projectMode: true,
    targets: ["~/src/app"],
  });
});

it("parseArgs - keeps normal targets in non-project mode", () => {
  assert.deepEqual(parseArgs(["notes.txt", "https://example.com"]), {
    projectMode: false,
    targets: ["notes.txt", "https://example.com"],
  });
});

it("parseOpenConfig - defaults to nvim for small text and hx for large text", () => {
  assert.deepEqual(parseOpenConfig({}), {
    largeTextBytes: DEFAULT_LARGE_TEXT_BYTES,
    largeTextEditor: "hx",
    projectEditor: "zeditor",
    smallTextEditor: "nvim",
    terminal: "kitty",
    xdgOpen: "xdg-open",
  });
});

it("parseOpenConfig - allows environment overrides", () => {
  assert.deepEqual(
    parseOpenConfig({
      OPEN_LARGE_TEXT_BYTES: "2048",
      OPEN_LARGE_TEXT_EDITOR: "helix",
      OPEN_PROJECT_EDITOR: "zed",
      OPEN_SMALL_TEXT_EDITOR: "vim",
      OPEN_TERMINAL: "alacritty",
      OPEN_XDG_OPEN: "gio open",
    }),
    {
      largeTextBytes: 2048,
      largeTextEditor: "helix",
      projectEditor: "zed",
      smallTextEditor: "vim",
      terminal: "alacritty",
      xdgOpen: "gio open",
    },
  );
});

it("isProbablyTextPath - recognizes extensionless text-like names", () => {
  assert.strictEqual(isProbablyTextPath("README"), true);
  assert.strictEqual(isProbablyTextPath(".zshrc"), true);
});

it("isProbablyTextPath - recognizes code and config extensions", () => {
  assert.strictEqual(isProbablyTextPath("main.ts"), true);
  assert.strictEqual(isProbablyTextPath("flake.nix"), true);
});

it("isProbablyTextPath - does not classify common media extensions as text", () => {
  assert.strictEqual(isProbablyTextPath("photo.png"), false);
  assert.strictEqual(isProbablyTextPath("movie.mkv"), false);
});

it("planOpenTarget - opens small text in kitty nvim", () => {
  const config = parseOpenConfig({});

  assert.deepEqual(
    planOpenTarget({
      config,
      isDirectory: false,
      mimeType: "text/plain",
      path: "notes.txt",
      sizeBytes: 1024,
    }),
    {
      args: ["kitty", "nvim", "notes.txt"],
      command: "kitty",
      detach: true,
      kind: "terminal-editor",
    },
  );
});

it("planOpenTarget - opens large text in kitty hx", () => {
  const config = parseOpenConfig({});

  assert.deepEqual(
    planOpenTarget({
      config,
      isDirectory: false,
      mimeType: "text/plain",
      path: "large.log",
      sizeBytes: DEFAULT_LARGE_TEXT_BYTES,
    }),
    {
      args: ["kitty", "hx", "large.log"],
      command: "kitty",
      detach: true,
      kind: "terminal-editor",
    },
  );
});

it("planOpenTarget - delegates directories and binary files to xdg-open", () => {
  const config = parseOpenConfig({});

  const r1 = planOpenTarget({
    config,
    isDirectory: true,
    mimeType: "inode/directory",
    path: ".",
    sizeBytes: 0,
  });
  assert.strictEqual(r1.kind, "xdg-open");
  assert.deepEqual(r1.args, ["xdg-open", "."]);

  const r2 = planOpenTarget({
    config,
    isDirectory: false,
    mimeType: "image/png",
    path: "photo.png",
    sizeBytes: 100,
  });
  assert.strictEqual(r2.kind, "xdg-open");
  assert.deepEqual(r2.args, ["xdg-open", "photo.png"]);
});

it("buildOpenCommand - routes URLs to xdg-open without filesystem checks", async () => {
  const result = await buildOpenCommand("https://example.com");
  assert.strictEqual(result.kind, "xdg-open");
  assert.deepEqual(result.args, ["xdg-open", "https://example.com"]);
});

it("buildOpenCommand - routes project mode to zeditor", async () => {
  assert.deepEqual(await buildOpenCommand(".", parseOpenConfig({}), true), {
    args: ["zeditor", "."],
    command: "zeditor",
    detach: true,
    kind: "project-editor",
  });
});
