#!/usr/bin/env tsx

import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { spawnDetached, readStdin, isMain } from "./utils.ts";

const PORT = 58721;
const HOST = "127.0.0.1";
const TIMEOUT_MS = 10_000;
const SHUTDOWN_DELAY_MS = 2_000;

async function main(): Promise<number> {
  const content = await readStdin();
  if (!content.trim()) {
    console.error("gemini-bridge: no input from stdin");
    return 1;
  }

  let served = false;
  let noRequestTimer: ReturnType<typeof setTimeout>;
  let shutdownTimer: ReturnType<typeof setTimeout> | null = null;

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === "/pull" && req.method === "GET") {
      clearTimeout(noRequestTimer);

      if (!served) {
        served = true;
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(content);
        shutdownTimer = setTimeout(() => server.close(), SHUTDOWN_DELAY_MS);
      } else {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("");
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  noRequestTimer = setTimeout(() => {
    if (!served) {
      console.error("gemini-bridge: timeout, no request received");
    }
    server.close();
  }, TIMEOUT_MS);

  process.on("SIGINT", () => server.close());
  process.on("SIGTERM", () => server.close());

  return new Promise((resolve) => {
    server.listen(PORT, HOST, () => {
      spawnDetached("xdg-open", ["https://gemini.google.com/"]);
    });

    server.on("close", () => {
      clearTimeout(noRequestTimer);
      if (shutdownTimer) clearTimeout(shutdownTimer);
      resolve(0);
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(`gemini-bridge: port ${PORT} already in use`);
      } else {
        console.error("gemini-bridge: server error:", err.message);
      }
      resolve(1);
    });
  });
}

if (isMain(import.meta.url)) {
  main().then((code) => process.exit(code));
}
