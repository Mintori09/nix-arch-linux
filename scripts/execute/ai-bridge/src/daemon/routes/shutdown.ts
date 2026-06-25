import http from "http";

export function handleShutdown(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  server: http.Server,
) {
  res.writeHead(200);
  res.end(JSON.stringify({ ok: true }));
  setTimeout(() => {
    server.close(() => process.exit(0));
  }, 200);
}
