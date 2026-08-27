import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { resolve } from "path";
import os from "os";
import http from "http";

const TEST_DIR = resolve(os.tmpdir(), "ai-bridge-test-prompts");

function makeResponse() {
  const chunks: Buffer[] = [];
  let statusCode = 0;
  let headers: Record<string, string> = {};
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    writeHead: function (code: number, h: Record<string, string>) {
      statusCode = code;
      headers = h;
    },
    end: function (data: string) {
      chunks.push(Buffer.from(data));
    },
  };
  const getResult = () => ({
    status: statusCode,
    headers,
    body: JSON.parse(Buffer.concat(chunks).toString()),
  });
  return { res, getResult };
}

describe("prompts handler", () => {
  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("handleListPrompts returns empty array when dir missing", async () => {
    const { handleListPrompts } =
      await import("../../src/daemon/routes/prompts");
    const req = {} as http.IncomingMessage;
    const { res, getResult } = makeResponse();
    handleListPrompts(req, res as any, "/nonexistent/prompts");
    const result = getResult();
    expect(result.status).toBe(200);
    expect(result.body).toEqual([]);
  });

  it("handleListPrompts lists .md files", async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      resolve(TEST_DIR, "test-prompt.md"),
      "Summarize the following content:\n\n{{content}}",
    );
    const { handleListPrompts } =
      await import("../../src/daemon/routes/prompts");
    const req = {} as http.IncomingMessage;
    const { res, getResult } = makeResponse();
    handleListPrompts(req, res as any, TEST_DIR);
    const result = getResult();
    expect(result.status).toBe(200);
    expect(result.body.length).toBeGreaterThanOrEqual(1);
    const found = result.body.find((p: any) => p.name === "test-prompt.md");
    expect(found).toBeDefined();
    expect(found.title).toBe("test-prompt");
    expect(found.preview).toContain("Summarize");
  });

  it("handleGetPrompt returns file content", async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      resolve(TEST_DIR, "test-prompt.md"),
      "Summarize the following content:\n\n{{content}}",
    );
    const { handleGetPrompt } = await import("../../src/daemon/routes/prompts");
    const req = {} as http.IncomingMessage;
    const { res, getResult } = makeResponse();
    handleGetPrompt(req, res as any, TEST_DIR, "test-prompt.md");
    const result = getResult();
    expect(result.status).toBe(200);
    expect(result.body.name).toBe("test-prompt.md");
    expect(result.body.content).toContain("{{content}}");
  });

  it("handleGetPrompt returns 404 for missing file", async () => {
    const { handleGetPrompt } = await import("../../src/daemon/routes/prompts");
    const req = {} as http.IncomingMessage;
    const { res, getResult } = makeResponse();
    handleGetPrompt(req, res as any, TEST_DIR, "nonexistent.md");
    const result = getResult();
    expect(result.status).toBe(404);
  });

  it("handleGetPrompt rejects path traversal", async () => {
    const { handleGetPrompt } = await import("../../src/daemon/routes/prompts");
    const req = {} as http.IncomingMessage;
    const { res, getResult } = makeResponse();
    handleGetPrompt(req, res as any, TEST_DIR, "../etc/passwd");
    const result = getResult();
    expect(result.status).toBe(400);
  });

  it("handleGetPrompt rejects non-.md files", async () => {
    const { handleGetPrompt } = await import("../../src/daemon/routes/prompts");
    const req = {} as http.IncomingMessage;
    const { res, getResult } = makeResponse();
    handleGetPrompt(req, res as any, TEST_DIR, "test.txt");
    const result = getResult();
    expect(result.status).toBe(400);
  });

  it("handleGetPrompt strips BOM from content", async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      resolve(TEST_DIR, "bom-prompt.md"),
      "\uFEFFSummarize the following content:\n\n{{content}}",
    );
    const { handleGetPrompt } = await import("../../src/daemon/routes/prompts");
    const req = {} as http.IncomingMessage;
    const { res, getResult } = makeResponse();
    handleGetPrompt(req, res as any, TEST_DIR, "bom-prompt.md");
    const result = getResult();
    expect(result.status).toBe(200);
    expect(result.body.content.charCodeAt(0)).not.toBe(0xfeff);
    expect(result.body.content.startsWith("Summarize")).toBe(true);
  });

  it("handleListPrompts strips frontmatter from preview", async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      resolve(TEST_DIR, "frontmatter-prompt.md"),
      "---\ntitle: My Prompt\n---\nSummarize the following content:\n\n{{content}}",
    );
    const { handleListPrompts } =
      await import("../../src/daemon/routes/prompts");
    const req = {} as http.IncomingMessage;
    const { res, getResult } = makeResponse();
    handleListPrompts(req, res as any, TEST_DIR);
    const result = getResult();
    expect(result.status).toBe(200);
    const found = result.body.find(
      (p: any) => p.name === "frontmatter-prompt.md",
    );
    expect(found).toBeDefined();
    expect(found.preview).not.toContain("---");
    expect(found.preview).toContain("Summarize");
  });

  it("handleListPrompts excludes non-.md files", async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(resolve(TEST_DIR, "prompt.md"), "content");
    writeFileSync(resolve(TEST_DIR, "notes.txt"), "not a prompt");
    writeFileSync(resolve(TEST_DIR, "script.js"), "// not a prompt");
    const { handleListPrompts } =
      await import("../../src/daemon/routes/prompts");
    const req = {} as http.IncomingMessage;
    const { res, getResult } = makeResponse();
    handleListPrompts(req, res as any, TEST_DIR);
    const result = getResult();
    expect(result.status).toBe(200);
    expect(result.body.length).toBe(1);
    expect(result.body[0].name).toBe("prompt.md");
  });

  it("handleGetPrompt enforces resolved path is within prompts directory", async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(resolve(TEST_DIR, "simple.md"), "content");
    const { handleGetPrompt } = await import("../../src/daemon/routes/prompts");
    const req = {} as http.IncomingMessage;
    const { res, getResult } = makeResponse();
    handleGetPrompt(req, res as any, TEST_DIR, "simple.md");
    const result = getResult();
    expect(result.status).toBe(200);
    expect(result.body.content).toBe("content");
  });
});
