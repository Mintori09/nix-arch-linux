export interface QueueEntry {
  id: string;
  title: string;
  text: string;
  createdAt: number;
  ttl: number;
}

export interface QueueItem {
  id: string;
  title: string;
  textPreview: string;
  remainingTtlMs: number;
}

export function createQueue() {
  const entries = new Map<string, QueueEntry>();
  let counter = 0;
  let enqueuedCount = 0;
  let dequeuedCount = 0;

  function generateId(): string {
    return `${Date.now()}-${++counter}`;
  }

  function isExpired(entry: QueueEntry): boolean {
    return Date.now() - entry.createdAt > entry.ttl;
  }

  function cleanup() {
    for (const [id, entry] of entries) {
      if (isExpired(entry)) entries.delete(id);
    }
  }

  function enqueue(opts: {
    text: string;
    title?: string;
    ttl?: number;
  }): string {
    cleanup();
    const id = generateId();
    entries.set(id, {
      id,
      title: opts.title ?? "",
      text: opts.text,
      createdAt: Date.now(),
      ttl: opts.ttl ?? 60000,
    });
    enqueuedCount++;
    return id;
  }

  function dequeue(): { id?: string; text: string } {
    cleanup();
    let oldestId: string | null = null;
    let oldestTime = Infinity;
    for (const [id, entry] of entries) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestId = id;
      }
    }
    if (!oldestId) return { text: "" };
    const entry = entries.get(oldestId)!;
    entries.delete(oldestId);
    dequeuedCount++;
    return { id: oldestId, text: entry.text };
  }

  function list(): QueueItem[] {
    cleanup();
    const items: QueueItem[] = [];
    for (const [, entry] of entries) {
      const remainingTtlMs = Math.max(
        0,
        entry.ttl - (Date.now() - entry.createdAt),
      );
      const textPreview =
        entry.text.length > 80 ? entry.text.slice(0, 80) + "..." : entry.text;
      items.push({
        id: entry.id,
        title: entry.title,
        textPreview,
        remainingTtlMs,
      });
    }
    return items;
  }

  function clear(): number {
    const count = entries.size;
    entries.clear();
    return count;
  }

  function status(id: string): {
    found: boolean;
    expired: boolean;
    text?: string;
  } {
    const entry = entries.get(id);
    if (!entry) return { found: false, expired: false };
    const expired = isExpired(entry);
    return { found: true, expired, text: entry.text };
  }

  function stats(): {
    uptimeSec: number;
    enqueued: number;
    dequeued: number;
    queueLength: number;
  } {
    cleanup();
    return {
      uptimeSec: 0,
      enqueued: enqueuedCount,
      dequeued: dequeuedCount,
      queueLength: entries.size,
    };
  }

  return { enqueue, dequeue, list, clear, status, stats };
}
