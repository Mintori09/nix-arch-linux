import { describe, it } from "node:test";
import assert from "node:assert";

import {
  DEFAULT_LARGE_TEXT_BYTES,
  buildOpenCommand,
  isProbablyTextPath,
  parseArgs,
  parseOpenConfig,
  planOpenTarget,
} from "./open";

describe("parseArgs", () => {
  it("parses project mode with long and short flags", () => {
    assert.deepStrictEqual(parseArgs(["--project", "."]), {
      projectMode: true,
      targets: ["."],
    });

    assert.deepStrictEqual(parseArgs(["-p", "~/src/app"]), {
      projectMode: true,
      targets: ["~/src/app"],
    });
  });

  it("keeps normal targets in non-project mode", () => {
    assert.deepStrictEqual(parseArgs(["notes.txt", "https://example.com"]), {
      projectMode: false,
      targets: ["notes.txt", "https://example.com"],
    });
  });
});

describe("parseOpenConfig", () => {
  it("defaults to nvim for small text and hx for large text", () => {
    assert.deepStrictEqual(parseOpenConfig({}), {
      largeTextBytes: DEFAULT_LARGE_TEXT_BYTES,
      largeTextEditor: "hx",
      projectEditor: "zeditor",
      smallTextEditor: "nvim",
      terminal: "kitty",
      xdgOpen: "xdg-open",
    });
  });

  it("allows environment overrides", () => {
    assert.deepStrictEqual(
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
});

describe("isProbablyTextPath", () => {
  it("recognizes extensionless text-like names", () => {
    assert.strictEqual(isProbablyTextPath("README"), true);
    assert.strictEqual(isProbablyTextPath(".zshrc"), true);
  });

  it("recognizes code and config extensions", () => {
    assert.strictEqual(isProbablyTextPath("main.ts"), true);
    assert.strictEqual(isProbablyTextPath("flake.nix"), true);
  });

  it("does not classify common media extensions as text", () => {
    assert.strictEqual(isProbablyTextPath("photo.png"), false);
    assert.strictEqual(isProbablyTextPath("movie.mkv"), false);
  });
});

describe("planOpenTarget", () => {
  const config = parseOpenConfig({});

  it("opens small text in kitty nvim", () => {
    assert.deepStrictEqual(
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

  it("opens large text in kitty hx", () => {
    assert.deepStrictEqual(
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

  it("delegates directories and binary files to xdg-open", () => {
    const r1 = planOpenTarget({
      config,
      isDirectory: true,
      mimeType: "inode/directory",
      path: ".",
      sizeBytes: 0,
    });
    assert.strictEqual(r1.kind, "xdg-open");
    assert.deepStrictEqual(r1.args, ["xdg-open", "."]);

    const r2 = planOpenTarget({
      config,
      isDirectory: false,
      mimeType: "image/png",
      path: "photo.png",
      sizeBytes: 100,
    });
    assert.strictEqual(r2.kind, "xdg-open");
    assert.deepStrictEqual(r2.args, ["xdg-open", "photo.png"]);
  });
});

describe("buildOpenCommand", () => {
  it("routes URLs to xdg-open without filesystem checks", async () => {
    const result = await buildOpenCommand("https://example.com");
    assert.strictEqual(result.kind, "xdg-open");
    assert.deepStrictEqual(result.args, ["xdg-open", "https://example.com"]);
  });

  it("routes project mode to zeditor", async () => {
    assert.deepStrictEqual(
      await buildOpenCommand(".", parseOpenConfig({}), true),
      {
        args: ["zeditor", "."],
        command: "zeditor",
        detach: true,
        kind: "project-editor",
      },
    );
  });
});
