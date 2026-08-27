import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { startServer } from "../../src/daemon/server";

describe("Server integration", () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    const s = await startServer(0);
    server = s.server;
    port = s.port;
  });

  it("health check returns alive", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.alive).toBe(true);
  });

  it("enqueue and dequeue round-trip", async () => {
    const enq = await fetch(`http://127.0.0.1:${port}/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello world", title: "Test", ttl: 60000 }),
    });
    const enqData = await enq.json();
    expect(enqData.ok).toBe(true);

    const deq = await fetch(`http://127.0.0.1:${port}/dequeue`, {
      method: "POST",
    });
    const deqData = await deq.json();
    expect(deqData.text).toBe("hello world");
  });

  it("rejects payload > 200KB via Content-Length", async () => {
    const largeBody = "x".repeat(300000);
    const res = await fetch(`http://127.0.0.1:${port}/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: largeBody, ttl: 60000 }),
    });
    expect(res.status).toBe(413);
  });

  it("enqueue returns 413 for text > 100000 chars", async () => {
    const longText = "x".repeat(100001);
    const res = await fetch(`http://127.0.0.1:${port}/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: longText, ttl: 60000 }),
    });
    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.error).toContain("100000");
  });

  it("enqueue requires text field", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 60000 }),
    });
    expect(res.status).toBe(400);
  });

  it("queue list returns enqueued items", async () => {
    await fetch(`http://127.0.0.1:${port}/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "list test",
        title: "ListTest",
        ttl: 60000,
      }),
    });
    const res = await fetch(`http://127.0.0.1:${port}/queue`);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    const item = data.find((i: any) => i.title === "ListTest");
    expect(item).toBeDefined();
    await fetch(`http://127.0.0.1:${port}/queue`, { method: "DELETE" }); // drain
  });

  it("delete queue clears all", async () => {
    await fetch(`http://127.0.0.1:${port}/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "clear me", ttl: 60000 }),
    });
    const del = await fetch(`http://127.0.0.1:${port}/queue`, {
      method: "DELETE",
    });
    const delData = await del.json();
    expect(delData.cleared).toBeGreaterThanOrEqual(1);

    const list = await fetch(`http://127.0.0.1:${port}/queue`);
    expect((await list.json()).length).toBe(0);
  });

  it("stats returns counters", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/stats`);
    const data = await res.json();
    expect(typeof data.enqueued).toBe("number");
    expect(typeof data.dequeued).toBe("number");
    expect(typeof data.uptimeSec).toBe("number");
  });

  it("health includes queue length", async () => {
    await fetch(`http://127.0.0.1:${port}/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "health test", ttl: 60000 }),
    });
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const data = await res.json();
    expect(typeof data.queueLength).toBe("number");
    await fetch(`http://127.0.0.1:${port}/queue`, { method: "DELETE" }); // drain
  });

  afterAll(() => {
    server?.close();
  });
});
