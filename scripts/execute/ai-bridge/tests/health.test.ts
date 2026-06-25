import { describe, it, expect } from "vitest";
import { waitForDaemon } from "../src/health";

describe("waitForDaemon", () => {
  it("returns false when daemon not reachable", async () => {
    const result = await waitForDaemon("http://127.0.0.1:1", 50, 200);
    expect(result).toBe(false);
  });
});
