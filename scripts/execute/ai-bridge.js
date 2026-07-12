#!/usr/bin/env tsx

// src/utils.ts
function readStdin() {
  return new Promise((resolve2) => {
    if (process.stdin.isTTY) {
      resolve2("");
      return;
    }
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk.toString());
    process.stdin.on("end", () => resolve2(data.trim()));
  });
}

// src/config.ts
var DAEMON_HOST = process.env.DAEMON_HOST ?? "127.0.0.1";
var DAEMON_PORT = process.env.AI_BRIDGE_PORT ?? "58721";
var DAEMON_URL = `http://${DAEMON_HOST}:${DAEMON_PORT}`;
var AI_BRIDGE_PROMPTS_DIR = process.env.AI_BRIDGE_PROMPTS_DIR ?? "~/.config/ai-bridge/prompts/";

// src/cli/commands/enqueue.ts
async function cmdEnqueue(text, title, ttl) {
  const res = await fetch(`${DAEMON_URL}/enqueue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, title, ttl })
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(data.error ?? "Request failed");
    process.exit(1);
  }
  console.log(JSON.stringify(data));
}

// src/cli/commands/clipboard.ts
async function cmdClipboard(opts) {
  if (opts.pasteOnly) {
    const res2 = await fetch(`${DAEMON_URL}/clipboard`);
    const data2 = await res2.json();
    if (!res2.ok) {
      console.error(data2.error ?? "Request failed");
      process.exit(1);
    }
    console.log(JSON.stringify(data2));
    return;
  }
  const res = await fetch(`${DAEMON_URL}/clipboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: opts.title, ttl: opts.ttl })
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(data.error ?? "Request failed");
    process.exit(1);
  }
  console.log(JSON.stringify(data));
}

// src/cli/commands/queue.ts
async function cmdQueue() {
  const res = await fetch(`${DAEMON_URL}/queue`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
async function cmdClear() {
  const res = await fetch(`${DAEMON_URL}/queue`, { method: "DELETE" });
  const data = await res.json();
  console.log(JSON.stringify(data));
}

// src/cli/commands/status.ts
async function cmdStatus(id) {
  const res = await fetch(`${DAEMON_URL}/status/${id}`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

// src/cli/commands/stats.ts
async function cmdStats() {
  const res = await fetch(`${DAEMON_URL}/stats`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

// src/cli/commands/health.ts
async function cmdHealth() {
  try {
    const res = await fetch(`${DAEMON_URL}/health`);
    const data = await res.json();
    console.log(JSON.stringify(data));
  } catch {
    console.error("Daemon not running");
    process.exit(1);
  }
}

// src/cli/commands/focus.ts
async function cmdFocus() {
  const res = await fetch(`${DAEMON_URL}/focus`, { method: "POST" });
  const data = await res.json();
  console.log(JSON.stringify(data));
}

// src/daemon/server.ts
import http from "http";

// src/daemon/queue.ts
function createQueue() {
  const entries = /* @__PURE__ */ new Map();
  let counter = 0;
  let enqueuedCount = 0;
  let dequeuedCount = 0;
  function generateId() {
    return `${Date.now()}-${++counter}`;
  }
  function isExpired(entry) {
    return Date.now() - entry.createdAt > entry.ttl;
  }
  function cleanup() {
    for (const [id, entry] of entries) {
      if (isExpired(entry)) entries.delete(id);
    }
  }
  function enqueue(opts) {
    cleanup();
    const id = generateId();
    entries.set(id, {
      id,
      title: opts.title ?? "",
      text: opts.text,
      createdAt: Date.now(),
      ttl: opts.ttl ?? 6e4
    });
    enqueuedCount++;
    return id;
  }
  function dequeue() {
    cleanup();
    let oldestId = null;
    let oldestTime = Infinity;
    for (const [id, entry2] of entries) {
      if (entry2.createdAt < oldestTime) {
        oldestTime = entry2.createdAt;
        oldestId = id;
      }
    }
    if (!oldestId) return { text: "" };
    const entry = entries.get(oldestId);
    entries.delete(oldestId);
    dequeuedCount++;
    return { id: oldestId, text: entry.text };
  }
  function list() {
    cleanup();
    const items = [];
    for (const [, entry] of entries) {
      const remainingTtlMs = Math.max(
        0,
        entry.ttl - (Date.now() - entry.createdAt)
      );
      const textPreview = entry.text.length > 80 ? entry.text.slice(0, 80) + "..." : entry.text;
      items.push({
        id: entry.id,
        title: entry.title,
        textPreview,
        remainingTtlMs
      });
    }
    return items;
  }
  function clear() {
    const count = entries.size;
    entries.clear();
    return count;
  }
  function status(id) {
    const entry = entries.get(id);
    if (!entry) return { found: false, expired: false };
    const expired = isExpired(entry);
    return { found: true, expired, text: entry.text };
  }
  function stats() {
    cleanup();
    return {
      uptimeSec: 0,
      enqueued: enqueuedCount,
      dequeued: dequeuedCount,
      queueLength: entries.size
    };
  }
  return { enqueue, dequeue, list, clear, status, stats };
}

// src/daemon/clipboard.ts
import { execFile } from "child_process";
function detectClipboardCommand() {
  if (process.env.WAYLAND_DISPLAY) {
    return { cmd: "wl-paste", args: [] };
  }
  return { cmd: "xclip", args: ["-o", "-selection", "clipboard"] };
}
function readClipboard(timeoutMs = 500) {
  return new Promise((resolve2) => {
    const { cmd, args } = detectClipboardCommand();
    const child = execFile(
      cmd,
      args,
      { timeout: timeoutMs },
      (err, stdout) => {
        if (err) {
          if (err.code === "ENOENT") {
            resolve2(null);
            return;
          }
          resolve2("");
          return;
        }
        resolve2(stdout);
      }
    );
    const timer = setTimeout(() => {
      child.kill();
      resolve2("");
    }, timeoutMs);
    child.on("close", () => clearTimeout(timer));
  });
}

// src/daemon/focus.ts
import { execFile as execFile2 } from "child_process";
function openBrowser(url) {
  return new Promise((resolve2) => {
    execFile2("xdg-open", [url], (err) => {
      if (err && err.code !== "ENOENT") {
        console.warn(`[ai-bridge] xdg-open failed: ${err.message}`);
      }
      resolve2();
    });
  });
}
function focusBrowser() {
  return new Promise((resolve2) => {
    execFile2("kdotool", ["search", "--class", "google-chrome", "windowactivate"], (err) => {
      if (err && err.code !== "ENOENT") {
        console.warn(`[ai-bridge] kdotool failed: ${err.message}`);
      }
      resolve2();
    });
  });
}

// src/daemon/routes/enqueue.ts
function handleEnqueue(_req, res, body, queue, openBrowser2, focusBrowser2) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }
  if (!parsed.text || typeof parsed.text !== "string" || parsed.text.trim().length === 0) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "text is required" }));
    return;
  }
  if (parsed.text.length > 1e5) {
    res.writeHead(413, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Max 100000 characters" }));
    return;
  }
  if (parsed.title && (typeof parsed.title !== "string" || parsed.title.length > 200)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "title max 200 characters" }));
    return;
  }
  const id = queue.enqueue({
    text: parsed.text,
    title: parsed.title ?? "Prompt",
    ttl: parsed.ttl ?? 6e4
  });
  openBrowser2("https://gemini.google.com").catch(() => {
  });
  focusBrowser2().catch(() => {
  });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ id, ok: true }));
}

// src/daemon/routes/dequeue.ts
function handleDequeue(_req, res, queue) {
  const result = queue.dequeue();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}

// src/daemon/routes/queue.ts
function handleListQueue(_req, res, queue) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(queue.list()));
}
function handleClearQueue(_req, res, queue) {
  const cleared = queue.clear();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ cleared }));
}

// src/daemon/routes/status.ts
function handleStatus(_req, res, id, queue) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(queue.status(id)));
}

// src/daemon/routes/stats.ts
function handleStats(_req, res, queue, startTime) {
  const stats = queue.stats();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ...stats, uptimeSec: Math.floor((Date.now() - startTime) / 1e3) }));
}

// src/daemon/routes/health.ts
function handleHealth(_req, res, queue) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ alive: true, queueLength: queue.list().length }));
}

// src/daemon/routes/focus.ts
function handleFocus(_req, res, focusBrowser2) {
  focusBrowser2().catch(() => {
  });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}

// src/daemon/routes/clipboard.ts
async function handleClipboardPost(_req, res, body, readClipboard2, queue, openBrowser2, focusBrowser2) {
  let parsed = {};
  try {
    parsed = JSON.parse(body);
  } catch {
  }
  const text = await readClipboard2();
  if (text === null) {
    res.writeHead(501, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Clipboard tool not found. Install wl-clipboard (Wayland) or xclip (X11)."
      })
    );
    return;
  }
  const id = queue.enqueue({ text, title: parsed.title, ttl: parsed.ttl });
  openBrowser2("https://gemini.google.com").catch(() => {
  });
  focusBrowser2().catch(() => {
  });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ id, ok: true }));
}
async function handleClipboardGet(_req, res, readClipboard2) {
  const text = await readClipboard2();
  if (text === null) {
    res.writeHead(501, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Clipboard tool not found. Install wl-clipboard (Wayland) or xclip (X11)."
      })
    );
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ text }));
}

// src/daemon/routes/shutdown.ts
function handleShutdown(_req, res, server) {
  res.writeHead(200);
  res.end(JSON.stringify({ ok: true }));
  setTimeout(() => {
    server.close(() => process.exit(0));
  }, 200);
}

// src/daemon/routes/prompts.ts
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { resolve, sep } from "path";
import os from "os";
function expandHome(dir) {
  if (dir.startsWith("~")) {
    return resolve(os.homedir(), dir.slice(1));
  }
  return resolve(dir);
}
function stripBOM(content) {
  if (content.charCodeAt(0) === 65279) return content.slice(1);
  return content;
}
function handleListPrompts(_req, res, promptDir) {
  const dir = expandHome(promptDir);
  if (!existsSync(dir)) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([]));
    return;
  }
  try {
    const entries = readdirSync(dir);
    const prompts = entries.filter((e) => e.endsWith(".md") && statSync(resolve(dir, e)).isFile()).map((name) => {
      const content = readFileSync(resolve(dir, name), "utf-8");
      const clean = stripBOM(content);
      const preview = clean.replace(/---[\s\S]*?---/, "").slice(0, 80).trim();
      return {
        name,
        title: name.slice(0, -3),
        preview: preview + (preview.length === 80 ? "..." : "")
      };
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(prompts));
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to read prompts directory" }));
  }
}
function handleGetPrompt(_req, res, promptDir, name) {
  if (name.includes("..") || name.includes(sep)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid prompt name" }));
    return;
  }
  if (!name.endsWith(".md")) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Name must end with .md" }));
    return;
  }
  const dir = expandHome(promptDir);
  const filePath = resolve(dir, name);
  if (!filePath.startsWith(dir + sep)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid prompt name" }));
    return;
  }
  if (!existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Prompt not found" }));
    return;
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    const clean = stripBOM(content);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        name,
        title: name.slice(0, -3),
        content: clean
      })
    );
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to read prompt file" }));
  }
}

// src/daemon/server.ts
function parseBody(req) {
  return new Promise((resolve2) => {
    let body = "";
    req.on("data", (chunk) => body += chunk.toString());
    req.on("end", () => resolve2(body));
  });
}
async function startServer(port = parseInt(DAEMON_PORT, 10)) {
  const queue = createQueue();
  const startTime = Date.now();
  const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`
    );
    const pathname = url.pathname;
    const cl = parseInt(req.headers["content-length"] ?? "0", 10);
    if (cl > 2e5) {
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
          focusBrowser
        );
        return;
      }
      if (req.method === "GET" && pathname === "/clipboard") {
        await handleClipboardGet(req, res, readClipboard);
        return;
      }
      if (req.method === "GET" && pathname === "/prompts") {
        handleListPrompts(req, res, AI_BRIDGE_PROMPTS_DIR);
        return;
      }
      if (req.method === "GET" && pathname.startsWith("/prompts/")) {
        const name = pathname.slice(9);
        handleGetPrompt(req, res, AI_BRIDGE_PROMPTS_DIR, name);
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
  return new Promise((resolve2) => {
    server.listen(port, DAEMON_HOST, () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      resolve2({ server, port: actualPort });
    });
  });
}

// src/cli/commands/daemon.ts
async function cmdServer() {
  try {
    const res = await fetch(`${DAEMON_URL}/health`);
    if (res.ok) {
      console.error("ai-bridge already running");
      process.exit(1);
    }
  } catch {
  }
  const { port } = await startServer(parseInt(DAEMON_PORT, 10));
  console.log(`ai-bridge daemon listening on 127.0.0.1:${port}`);
}
async function cmdStop() {
  try {
    await fetch(`${DAEMON_URL}/shutdown`, { method: "POST" });
  } catch {
  }
  const start = Date.now();
  while (Date.now() - start < 5e3) {
    try {
      await fetch(`${DAEMON_URL}/health`);
    } catch {
      console.log("ai-bridge stopped");
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.error("ai-bridge failed to stop (timeout)");
  process.exit(1);
}

// src/cli/index.ts
async function ensureDaemon() {
  try {
    const res = await fetch(`${DAEMON_URL}/health`);
    if (res.ok) return;
  } catch {
  }
  console.error("Daemon not running. Start it with: ai-bridge server");
  process.exit(1);
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    const stdin = await readStdin();
    if (!stdin || stdin.trim().length === 0) process.exit(0);
    await ensureDaemon();
    await cmdEnqueue(stdin.trim());
    return;
  }
  const cmd = args[0];
  if (cmd === "clipboard") {
    const pasteOnly = args.includes("--paste-only");
    const titleIdx2 = args.indexOf("-t");
    const title2 = titleIdx2 >= 0 ? args[titleIdx2 + 1] : void 0;
    const ttlIdx2 = args.indexOf("--ttl");
    const ttl2 = ttlIdx2 >= 0 ? parseInt(args[ttlIdx2 + 1], 10) : void 0;
    await ensureDaemon();
    await cmdClipboard({ pasteOnly, title: title2, ttl: ttl2 });
    return;
  }
  if (cmd === "queue") {
    await ensureDaemon();
    await cmdQueue();
    return;
  }
  if (cmd === "clear") {
    await ensureDaemon();
    await cmdClear();
    return;
  }
  if (cmd === "status") {
    const id = args[1];
    if (!id) {
      console.error("Usage: ai-bridge status <id>");
      process.exit(1);
    }
    await ensureDaemon();
    await cmdStatus(id);
    return;
  }
  if (cmd === "stats") {
    await ensureDaemon();
    await cmdStats();
    return;
  }
  if (cmd === "health") {
    await cmdHealth();
    return;
  }
  if (cmd === "focus") {
    await ensureDaemon();
    await cmdFocus();
    return;
  }
  if (cmd === "server") {
    await cmdServer();
    return;
  }
  if (cmd === "stop") {
    await cmdStop();
    return;
  }
  if (cmd.startsWith("-")) {
    const stdin = await readStdin();
    if (!stdin || stdin.trim().length === 0) process.exit(0);
    const titleIdx2 = args.indexOf("-t");
    const title2 = titleIdx2 >= 0 ? args[titleIdx2 + 1] : void 0;
    const ttlIdx2 = args.indexOf("--ttl");
    const ttl2 = ttlIdx2 >= 0 ? parseInt(args[ttlIdx2 + 1], 10) : void 0;
    await ensureDaemon();
    await cmdEnqueue(stdin.trim(), title2, ttl2);
    return;
  }
  const text = args[0];
  const titleIdx = args.indexOf("-t");
  const title = titleIdx >= 0 ? args[titleIdx + 1] : void 0;
  const ttlIdx = args.indexOf("--ttl");
  const ttl = ttlIdx >= 0 ? parseInt(args[ttlIdx + 1], 10) : void 0;
  if (!text || text.trim().length === 0) process.exit(0);
  await ensureDaemon();
  await cmdEnqueue(text, title, ttl);
}
main().then(() => {
  const args = process.argv.slice(2);
  if (args[0] !== "server") {
    process.exit(0);
  }
}).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
