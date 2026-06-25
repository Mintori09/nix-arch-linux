import { describe, it, expect } from "vitest";
import { resolveFilename } from "../src/utils";

describe("resolveFilename", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(resolveFilename("My Chat Session")).toBe("my-chat-session");
  });

  it("strips non-alphanumeric except hyphens and dots", () => {
    expect(resolveFilename("Hello! World? [test]")).toBe("hello-world-test");
  });

  it("truncates to under 100 chars", () => {
    const long = "a".repeat(200);
    const result = resolveFilename(long);
    expect(result.length).toBeLessThan(100);
  });

  it("preserves dots", () => {
    expect(resolveFilename("File.Name.Test")).toBe("file.name.test");
  });

  it("handles empty string", () => {
    expect(resolveFilename("")).toBe("");
  });
});
