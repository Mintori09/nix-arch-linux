import { IncomingMessage, ServerResponse } from "http";

export function handleListQueue(
  _req: IncomingMessage,
  res: ServerResponse,
  queue: ReturnType<typeof import("../queue").createQueue>,
) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(queue.list()));
}

export function handleClearQueue(
  _req: IncomingMessage,
  res: ServerResponse,
  queue: ReturnType<typeof import("../queue").createQueue>,
) {
  const cleared = queue.clear();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ cleared }));
}
