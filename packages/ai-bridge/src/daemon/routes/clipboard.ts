import { IncomingMessage, ServerResponse } from "http";

export async function handleClipboardPost(
  _req: IncomingMessage,
  res: ServerResponse,
  body: string,
  readClipboard: () => Promise<string | null>,
  queue: ReturnType<typeof import("../queue").createQueue>,
  openBrowser: (url: string) => Promise<void>,
  focusBrowser: () => Promise<void>,
) {
  let parsed: { title?: string; ttl?: number } = {};
  try {
    parsed = JSON.parse(body);
  } catch {
    /* ignore parse errors, use defaults */
  }

  const text = await readClipboard();
  if (text === null) {
    res.writeHead(501, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error:
          "Clipboard tool not found. Install wl-clipboard (Wayland) or xclip (X11).",
      }),
    );
    return;
  }

  const id = queue.enqueue({ text, title: parsed.title, ttl: parsed.ttl });
  openBrowser("https://gemini.google.com").catch(() => {});
  focusBrowser().catch(() => {});

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ id, ok: true }));
}

export async function handleClipboardGet(
  _req: IncomingMessage,
  res: ServerResponse,
  readClipboard: () => Promise<string | null>,
) {
  const text = await readClipboard();
  if (text === null) {
    res.writeHead(501, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error:
          "Clipboard tool not found. Install wl-clipboard (Wayland) or xclip (X11).",
      }),
    );
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ text }));
}
