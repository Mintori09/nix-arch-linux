import { IncomingMessage, ServerResponse } from "http";

export function handleStatus(
  _req: IncomingMessage,
  res: ServerResponse,
  id: string,
  queue: ReturnType<typeof import("../queue").createQueue>,
) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(queue.status(id)));
}
