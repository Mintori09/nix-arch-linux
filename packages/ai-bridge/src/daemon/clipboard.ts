import { execFile, ChildProcess } from "child_process";

export function detectClipboardCommand(): { cmd: string; args: string[] } {
  if (process.env.WAYLAND_DISPLAY) {
    return { cmd: "wl-paste", args: [] };
  }
  return { cmd: "xclip", args: ["-o", "-selection", "clipboard"] };
}

export function readClipboard(timeoutMs = 500): Promise<string | null> {
  return new Promise((resolve) => {
    const { cmd, args } = detectClipboardCommand();
    const child: ChildProcess = execFile(
      cmd,
      args,
      { timeout: timeoutMs },
      (err, stdout) => {
        if (err) {
          if ((err as any).code === "ENOENT") {
            resolve(null);
            return;
          }
          resolve("");
          return;
        }
        resolve(stdout);
      },
    );
    const timer = setTimeout(() => {
      child.kill();
      resolve("");
    }, timeoutMs);
    child.on("close", () => clearTimeout(timer));
  });
}
