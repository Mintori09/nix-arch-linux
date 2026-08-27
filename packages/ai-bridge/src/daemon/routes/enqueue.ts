import { IncomingMessage, ServerResponse } from "http";

export function handleEnqueue(
  _req: IncomingMessage,
  res: ServerResponse,
  body: string,
  queue: ReturnType<typeof import("../queue").createQueue>,
  openBrowser: (url: string) => Promise<void>,
  focusBrowser: () => Promise<void>,
) {
  let parsed: { text?: string; title?: string; ttl?: number };
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  if (
    !parsed.text ||
    typeof parsed.text !== "string" ||
    parsed.text.trim().length === 0
  ) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "text is required" }));
    return;
  }

  if (parsed.text.length > 100000) {
    res.writeHead(413, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Max 100000 characters" }));
    return;
  }

  if (
    parsed.title &&
    (typeof parsed.title !== "string" || parsed.title.length > 200)
  ) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "title max 200 characters" }));
    return;
  }

  const id = queue.enqueue({
    text: parsed.text,
    title: parsed.title ?? "Prompt",
    ttl: parsed.ttl ?? 60000,
  });

  openBrowser("https://gemini.google.com").catch(() => {});
  focusBrowser().catch(() => {});

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ id, ok: true }));
}
