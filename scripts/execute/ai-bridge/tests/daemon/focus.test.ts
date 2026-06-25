import { describe, it, expect, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());
vi.mock("child_process", () => ({
  execFile: execFileMock,
}));

import { openBrowser, focusBrowser } from "../../src/daemon/focus";

describe("focus", () => {
  it("openBrowser calls xdg-open", async () => {
    execFileMock.mockImplementation(
      (_cmd: string, _a: string[], cb: Function) => {
        cb(null, "", "");
        return { unref: vi.fn() };
      },
    );
    await openBrowser("https://gemini.google.com");
    expect(execFileMock).toHaveBeenCalledWith(
      "xdg-open",
      ["https://gemini.google.com"],
      expect.any(Function),
    );
  });

  it("focusBrowser calls kdotool", async () => {
    execFileMock.mockImplementation(
      (_cmd: string, _a: string[], cb: Function) => {
        cb(null, "", "");
        return { unref: vi.fn() };
      },
    );
    await focusBrowser();
    expect(execFileMock).toHaveBeenCalledWith(
      "kdotool",
      expect.arrayContaining(["search"]),
      expect.any(Function),
    );
  });

  it("openBrowser does not throw on ENOENT", async () => {
    const err: any = new Error("ENOENT");
    err.code = "ENOENT";
    execFileMock.mockImplementation(
      (_cmd: string, _a: string[], cb: Function) => {
        cb(err, "", "");
        return { unref: vi.fn() };
      },
    );
    await expect(
      openBrowser("https://gemini.google.com"),
    ).resolves.toBeUndefined();
  });
});
