import { describe, it, expect, vi, beforeEach } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());
vi.mock("child_process", () => ({
  execFile: execFileMock,
}));

import { readClipboard } from "../../src/daemon/clipboard";

describe("readClipboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockChild(overrides: Record<string, any> = {}) {
    return { kill: vi.fn(), on: vi.fn(), unref: vi.fn(), ...overrides };
  }

  it("uses wl-paste when WAYLAND_DISPLAY is set", async () => {
    vi.stubEnv("WAYLAND_DISPLAY", "wayland-0");
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(null, "clipboard text", "");
        return mockChild();
      },
    );
    const result = await readClipboard();
    expect(result).toBe("clipboard text");
    expect(execFileMock).toHaveBeenCalledWith(
      "wl-paste",
      expect.any(Array),
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("uses xclip when WAYLAND_DISPLAY is not set", async () => {
    vi.stubEnv("WAYLAND_DISPLAY", "");
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(null, "xclip text", "");
        return mockChild();
      },
    );
    const result = await readClipboard();
    expect(result).toBe("xclip text");
    expect(execFileMock).toHaveBeenCalledWith(
      "xclip",
      ["-o", "-selection", "clipboard"],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns empty string on timeout", async () => {
    vi.stubEnv("WAYLAND_DISPLAY", "wayland-0");
    const killMock = vi.fn();
    const onMock = vi.fn();
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], _opts: any, cb: Function) => {
        setTimeout(() => cb(null, "slow", ""), 1000);
        return mockChild({ kill: killMock, on: onMock });
      },
    );
    const result = await readClipboard(100);
    expect(result).toBe("");
    expect(killMock).toHaveBeenCalled();
  });

  it("returns null when tool not found (ENOENT)", async () => {
    vi.stubEnv("WAYLAND_DISPLAY", "wayland-0");
    const err: any = new Error("spawn wl-paste ENOENT");
    err.code = "ENOENT";
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(err, "", "");
        return mockChild();
      },
    );
    const result = await readClipboard();
    expect(result).toBeNull();
  });
});
