import { IncomingMessage, ServerResponse } from "http";

export function handleStats(
  _req: IncomingMessage,
  res: ServerResponse,
  queue: ReturnType<typeof import("../queue").createQueue>,
  startTime: number,
) {
  const stats = queue.stats();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      ...stats,
      uptimeSec: Math.floor((Date.now() - startTime) / 1000),
    }),
  );
}
