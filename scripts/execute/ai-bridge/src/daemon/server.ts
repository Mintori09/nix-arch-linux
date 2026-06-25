import http from "http";
import { createQueue } from "./queue";
import { readClipboard } from "./clipboard";
import { openBrowser, focusBrowser } from "./focus";
import { handleEnqueue } from "./routes/enqueue";
import { handleDequeue } from "./routes/dequeue";
import { handleListQueue, handleClearQueue } from "./routes/queue";
import { handleStatus } from "./routes/status";
import { handleStats } from "./routes/stats";
import { handleHealth } from "./routes/health";
import { handleFocus } from "./routes/focus";
import { handleClipboardPost, handleClipboardGet } from "./routes/clipboard";
import { handleShutdown } from "./routes/shutdown";
import { DAEMON_HOST, DAEMON_PORT } from "../config";

function parseBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => resolve(body));
  });
}

export async function startServer(port = parseInt(DAEMON_PORT, 10)) {
  const queue = createQueue();
  const startTime = Date.now();

  const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const pathname = url.pathname;

    const cl = parseInt(req.headers["content-length"] ?? "0", 10);
    if (cl > 200_000) {
      res.writeHead(413);
      res.end(JSON.stringify({ error: "Payload too large" }));
      return;
    }

    try {
      if (req.method === "POST" && pathname === "/enqueue") {
        const body = await parseBody(req);
        handleEnqueue(req, res, body, queue, openBrowser, focusBrowser);
        return;
      }

      if (req.method === "POST" && pathname === "/dequeue") {
        handleDequeue(req, res, queue);
        return;
      }

      if (req.method === "GET" && pathname === "/queue") {
        handleListQueue(req, res, queue);
        return;
      }

      if (req.method === "DELETE" && pathname === "/queue") {
        handleClearQueue(req, res, queue);
        return;
      }

      if (req.method === "GET" && pathname.startsWith("/status/")) {
        const id = pathname.slice(8);
        handleStatus(req, res, id, queue);
        return;
      }

      if (req.method === "GET" && pathname === "/stats") {
        handleStats(req, res, queue, startTime);
        return;
      }

      if (req.method === "POST" && pathname === "/focus") {
        handleFocus(req, res, focusBrowser);
        return;
      }

      if (req.method === "POST" && pathname === "/clipboard") {
        const body = await parseBody(req);
        await handleClipboardPost(
          req,
          res,
          body,
          readClipboard,
          queue,
          openBrowser,
          focusBrowser,
        );
        return;
      }

      if (req.method === "GET" && pathname === "/clipboard") {
        await handleClipboardGet(req, res, readClipboard);
        return;
      }

      if (req.method === "GET" && pathname === "/health") {
        handleHealth(req, res, queue);
        return;
      }

      if (req.method === "POST" && pathname === "/shutdown") {
        handleShutdown(req, res, server);
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (err) {
      console.error("[ai-bridge] handler error:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  });

  function gracefulShutdown() {
    server.close(() => process.exit(0));
  }
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);

  return new Promise<{ server: http.Server; port: number }>((resolve) => {
    server.listen(port, DAEMON_HOST, () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      resolve({ server, port: actualPort });
    });
  });
}
