import { IncomingMessage, ServerResponse } from "http";

export function handleFocus(
  _req: IncomingMessage,
  res: ServerResponse,
  focusBrowser: () => Promise<void>,
) {
  focusBrowser().catch(() => {});
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}
