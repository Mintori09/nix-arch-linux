import { describe, it, expect, beforeEach } from "vitest";
import { createQueue } from "../../src/daemon/queue";

describe("Queue", () => {
  let queue: ReturnType<typeof createQueue>;

  beforeEach(() => {
    queue = createQueue();
  });

  it("enqueue adds entry and returns id", () => {
    const id = queue.enqueue({ text: "hello", title: "Prompt", ttl: 60000 });
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("dequeue returns oldest non-expired entry", () => {
    const id1 = queue.enqueue({ text: "first", title: "A", ttl: 60000 });
    queue.enqueue({ text: "second", title: "B", ttl: 60000 });
    const result = queue.dequeue();
    expect(result).toEqual({ id: id1, text: "first" });
  });

  it("dequeue returns empty when queue is empty", () => {
    const result = queue.dequeue();
    expect(result).toEqual({ text: "" });
  });

  it("dequeue skips expired entries", () => {
    queue.enqueue({ text: "expired", title: "E", ttl: -1 });
    const id2 = queue.enqueue({ text: "fresh", title: "F", ttl: 60000 });
    const result = queue.dequeue();
    expect(result).toEqual({ id: id2, text: "fresh" });
  });

  it("list returns pending entries", () => {
    queue.enqueue({ text: "hello world", title: "Test", ttl: 60000 });
    const list = queue.list();
    expect(list).toHaveLength(1);
    expect(list[0].textPreview).toBe("hello world");
    expect(typeof list[0].remainingTtlMs).toBe("number");
  });

  it("list shows empty string as default title", () => {
    queue.enqueue({ text: "hi", ttl: 60000 });
    const list = queue.list();
    expect(list[0].title).toBe("");
  });

  it("clear removes all entries", () => {
    queue.enqueue({ text: "a", title: "A", ttl: 60000 });
    queue.enqueue({ text: "b", title: "B", ttl: 60000 });
    const cleared = queue.clear();
    expect(cleared).toBe(2);
    expect(queue.list()).toHaveLength(0);
  });

  it("status returns entry info", () => {
    const id = queue.enqueue({ text: "test", title: "T", ttl: 60000 });
    const status = queue.status(id);
    expect(status.found).toBe(true);
    expect(status.expired).toBe(false);
    expect(status.text).toBe("test");
  });

  it("status returns not found for unknown id", () => {
    const status = queue.status("unknown");
    expect(status.found).toBe(false);
  });

  it("stats returns counters", () => {
    queue.enqueue({ text: "a", title: "A", ttl: 60000 });
    queue.dequeue();
    const stats = queue.stats();
    expect(stats.enqueued).toBe(1);
    expect(stats.dequeued).toBe(1);
    expect(stats.queueLength).toBe(0);
  });

  it("text preview truncates to 80 chars", () => {
    const long = "x".repeat(200);
    queue.enqueue({ text: long, title: "Long", ttl: 60000 });
    const list = queue.list();
    expect(list[0].textPreview.length).toBeLessThanOrEqual(83);
    expect(list[0].textPreview).toMatch(/\.\.\.$/);
  });
});
