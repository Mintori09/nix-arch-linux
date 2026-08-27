import { IncomingMessage, ServerResponse } from "http";

export function handleDequeue(
  _req: IncomingMessage,
  res: ServerResponse,
  queue: ReturnType<typeof import("../queue").createQueue>,
) {
  const result = queue.dequeue();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}
