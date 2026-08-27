#!/usr/bin/env tsx
import { readStdin } from "../utils";
import { cmdEnqueue } from "./commands/enqueue";
import { cmdClipboard } from "./commands/clipboard";
import { cmdQueue, cmdClear } from "./commands/queue";
import { cmdStatus } from "./commands/status";
import { cmdStats } from "./commands/stats";
import { cmdHealth } from "./commands/health";
import { cmdFocus } from "./commands/focus";
import { cmdServer, cmdStop } from "./commands/daemon";
import { DAEMON_URL } from "../config";

async function ensureDaemon() {
  try {
    const res = await fetch(`${DAEMON_URL}/health`);
    if (res.ok) return;
  } catch {}
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
    const titleIdx = args.indexOf("-t");
    const title = titleIdx >= 0 ? args[titleIdx + 1] : undefined;
    const ttlIdx = args.indexOf("--ttl");
    const ttl = ttlIdx >= 0 ? parseInt(args[ttlIdx + 1], 10) : undefined;
    await ensureDaemon();
    await cmdClipboard({ pasteOnly, title, ttl });
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
    const titleIdx = args.indexOf("-t");
    const title = titleIdx >= 0 ? args[titleIdx + 1] : undefined;
    const ttlIdx = args.indexOf("--ttl");
    const ttl = ttlIdx >= 0 ? parseInt(args[ttlIdx + 1], 10) : undefined;
    await ensureDaemon();
    await cmdEnqueue(stdin.trim(), title, ttl);
    return;
  }

  const text = args[0];
  const titleIdx = args.indexOf("-t");
  const title = titleIdx >= 0 ? args[titleIdx + 1] : undefined;
  const ttlIdx = args.indexOf("--ttl");
  const ttl = ttlIdx >= 0 ? parseInt(args[ttlIdx + 1], 10) : undefined;

  if (!text || text.trim().length === 0) process.exit(0);

  await ensureDaemon();
  await cmdEnqueue(text, title, ttl);
}

main()
  .then(() => {
    const args = process.argv.slice(2);
    if (args[0] !== "server") {
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
