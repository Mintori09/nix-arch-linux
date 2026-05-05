import { describe, expect, test } from "bun:test";

import {
  DEFAULT_LARGE_TEXT_BYTES,
  buildOpenCommand,
  isProbablyTextPath,
  parseArgs,
  parseOpenConfig,
  planOpenTarget,
} from "./open";

describe("parseArgs", () => {
  test("parses project mode with long and short flags", () => {
    expect(parseArgs(["--project", "."])).toEqual({
      projectMode: true,
      targets: ["."],
    });

    expect(parseArgs(["-p", "~/src/app"])).toEqual({
      projectMode: true,
      targets: ["~/src/app"],
    });
  });

  test("keeps normal targets in non-project mode", () => {
    expect(parseArgs(["notes.txt", "https://example.com"])).toEqual({
      projectMode: false,
      targets: ["notes.txt", "https://example.com"],
    });
  });
});

describe("parseOpenConfig", () => {
  test("defaults to nvim for small text and hx for large text", () => {
    expect(parseOpenConfig({})).toEqual({
      largeTextBytes: DEFAULT_LARGE_TEXT_BYTES,
      largeTextEditor: "hx",
      projectEditor: "zeditor",
      smallTextEditor: "nvim",
      terminal: "kitty",
      xdgOpen: "xdg-open",
    });
  });

  test("allows environment overrides", () => {
    expect(
      parseOpenConfig({
        OPEN_LARGE_TEXT_BYTES: "2048",
        OPEN_LARGE_TEXT_EDITOR: "helix",
        OPEN_PROJECT_EDITOR: "zed",
        OPEN_SMALL_TEXT_EDITOR: "vim",
        OPEN_TERMINAL: "alacritty",
        OPEN_XDG_OPEN: "gio open",
      }),
    ).toEqual({
      largeTextBytes: 2048,
      largeTextEditor: "helix",
      projectEditor: "zed",
      smallTextEditor: "vim",
      terminal: "alacritty",
      xdgOpen: "gio open",
    });
  });
});

describe("isProbablyTextPath", () => {
  test("recognizes extensionless text-like names", () => {
    expect(isProbablyTextPath("README")).toBe(true);
    expect(isProbablyTextPath(".zshrc")).toBe(true);
  });

  test("recognizes code and config extensions", () => {
    expect(isProbablyTextPath("main.ts")).toBe(true);
    expect(isProbablyTextPath("flake.nix")).toBe(true);
  });

  test("does not classify common media extensions as text", () => {
    expect(isProbablyTextPath("photo.png")).toBe(false);
    expect(isProbablyTextPath("movie.mkv")).toBe(false);
  });
});

describe("planOpenTarget", () => {
  const config = parseOpenConfig({});

  test("opens small text in kitty nvim", () => {
    expect(
      planOpenTarget({
        config,
        isDirectory: false,
        mimeType: "text/plain",
        path: "notes.txt",
        sizeBytes: 1024,
      }),
    ).toEqual({
      args: ["kitty", "nvim", "notes.txt"],
      command: "kitty",
      detach: true,
      kind: "terminal-editor",
    });
  });

  test("opens large text in kitty hx", () => {
    expect(
      planOpenTarget({
        config,
        isDirectory: false,
        mimeType: "text/plain",
        path: "large.log",
        sizeBytes: DEFAULT_LARGE_TEXT_BYTES,
      }),
    ).toEqual({
      args: ["kitty", "hx", "large.log"],
      command: "kitty",
      detach: true,
      kind: "terminal-editor",
    });
  });

  test("delegates directories and binary files to xdg-open", () => {
    expect(
      planOpenTarget({
        config,
        isDirectory: true,
        mimeType: "inode/directory",
        path: ".",
        sizeBytes: 0,
      }),
    ).toMatchObject({ args: ["xdg-open", "."], kind: "xdg-open" });

    expect(
      planOpenTarget({
        config,
        isDirectory: false,
        mimeType: "image/png",
        path: "photo.png",
        sizeBytes: 100,
      }),
    ).toMatchObject({ args: ["xdg-open", "photo.png"], kind: "xdg-open" });
  });
});

describe("buildOpenCommand", () => {
  test("routes URLs to xdg-open without filesystem checks", async () => {
    await expect(buildOpenCommand("https://example.com")).resolves.toMatchObject(
      {
        args: ["xdg-open", "https://example.com"],
        kind: "xdg-open",
      },
    );
  });

  test("routes project mode to zeditor", async () => {
    await expect(buildOpenCommand(".", parseOpenConfig({}), true)).resolves.toEqual(
      {
        args: ["zeditor", "."],
        command: "zeditor",
        detach: true,
        kind: "project-editor",
      },
    );
  });
});
