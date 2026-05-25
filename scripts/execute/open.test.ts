import { assertEquals, assertStrictEq } from "jsr:@std/assert";

import {
  DEFAULT_LARGE_TEXT_BYTES,
  buildOpenCommand,
  isProbablyTextPath,
  parseArgs,
  parseOpenConfig,
  planOpenTarget,
} from "./open.ts";

Deno.test("parseArgs - parses project mode with long and short flags", () => {
  assertEquals(parseArgs(["--project", "."]), {
    projectMode: true,
    targets: ["."],
  });

  assertEquals(parseArgs(["-p", "~/src/app"]), {
    projectMode: true,
    targets: ["~/src/app"],
  });
});

Deno.test("parseArgs - keeps normal targets in non-project mode", () => {
  assertEquals(parseArgs(["notes.txt", "https://example.com"]), {
    projectMode: false,
    targets: ["notes.txt", "https://example.com"],
  });
});

Deno.test("parseOpenConfig - defaults to nvim for small text and hx for large text", () => {
  assertEquals(parseOpenConfig({}), {
    largeTextBytes: DEFAULT_LARGE_TEXT_BYTES,
    largeTextEditor: "hx",
    projectEditor: "zeditor",
    smallTextEditor: "nvim",
    terminal: "kitty",
    xdgOpen: "xdg-open",
  });
});

Deno.test("parseOpenConfig - allows environment overrides", () => {
  assertEquals(
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

Deno.test("isProbablyTextPath - recognizes extensionless text-like names", () => {
  assertStrictEq(isProbablyTextPath("README"), true);
  assertStrictEq(isProbablyTextPath(".zshrc"), true);
});

Deno.test("isProbablyTextPath - recognizes code and config extensions", () => {
  assertStrictEq(isProbablyTextPath("main.ts"), true);
  assertStrictEq(isProbablyTextPath("flake.nix"), true);
});

Deno.test("isProbablyTextPath - does not classify common media extensions as text", () => {
  assertStrictEq(isProbablyTextPath("photo.png"), false);
  assertStrictEq(isProbablyTextPath("movie.mkv"), false);
});

Deno.test("planOpenTarget - opens small text in kitty nvim", () => {
  const config = parseOpenConfig({});

  assertEquals(
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

Deno.test("planOpenTarget - opens large text in kitty hx", () => {
  const config = parseOpenConfig({});

  assertEquals(
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

Deno.test("planOpenTarget - delegates directories and binary files to xdg-open", () => {
  const config = parseOpenConfig({});

  const r1 = planOpenTarget({
    config,
    isDirectory: true,
    mimeType: "inode/directory",
    path: ".",
    sizeBytes: 0,
  });
  assertStrictEq(r1.kind, "xdg-open");
  assertEquals(r1.args, ["xdg-open", "."]);

  const r2 = planOpenTarget({
    config,
    isDirectory: false,
    mimeType: "image/png",
    path: "photo.png",
    sizeBytes: 100,
  });
  assertStrictEq(r2.kind, "xdg-open");
  assertEquals(r2.args, ["xdg-open", "photo.png"]);
});

Deno.test("buildOpenCommand - routes URLs to xdg-open without filesystem checks", async () => {
  const result = await buildOpenCommand("https://example.com");
  assertStrictEq(result.kind, "xdg-open");
  assertEquals(result.args, ["xdg-open", "https://example.com"]);
});

Deno.test("buildOpenCommand - routes project mode to zeditor", async () => {
  assertEquals(
    await buildOpenCommand(".", parseOpenConfig({}), true),
    {
      args: ["zeditor", "."],
      command: "zeditor",
      detach: true,
      kind: "project-editor",
    },
  );
});