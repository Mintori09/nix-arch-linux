import { execFile } from "child_process";

export function openBrowser(url: string): Promise<void> {
  return new Promise((resolve) => {
    execFile("xdg-open", [url], (err) => {
      if (err && (err as any).code !== "ENOENT") {
        console.warn(`[ai-bridge] xdg-open failed: ${err.message}`);
      }
      resolve();
    });
  });
}

export function focusBrowser(): Promise<void> {
  return new Promise((resolve) => {
    execFile(
      "kdotool",
      ["search", "--class", "google-chrome", "windowactivate"],
      (err) => {
        if (err && (err as any).code !== "ENOENT") {
          console.warn(`[ai-bridge] kdotool failed: ${err.message}`);
        }
        resolve();
      },
    );
  });
}
