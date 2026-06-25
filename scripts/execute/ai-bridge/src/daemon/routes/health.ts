import { IncomingMessage, ServerResponse } from "http";

export function handleHealth(
  _req: IncomingMessage,
  res: ServerResponse,
  queue: ReturnType<typeof import("../queue").createQueue>,
) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ alive: true, queueLength: queue.list().length }));
}
