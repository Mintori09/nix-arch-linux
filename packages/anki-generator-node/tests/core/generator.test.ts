import { test, describe, mock } from "node:test";
import assert from "node:assert";
import { SEPARATOR } from "../../src/core/template.js";
import type { ParsedResult } from "../../src/types/index.js";
import type { BaseParser } from "../../src/parsers/base.js";

// ─── Mock anki-apkg-export ───────────────────────────────────────────────────
let addMediaCalls: Array<[string, Buffer]> = [];
let addCardCalls: Array<[string, string]> = [];
let saveImpl: () => Promise<Buffer> = async () => Buffer.from("zip");

class MockExporter {
  constructor(_name: string, _opts: unknown) {}
  addMedia(filename: string, buffer: Buffer) {
    addMediaCalls.push([filename, buffer]);
  }
  addCard(front: string, back: string) {
    addCardCalls.push([front, back]);
  }
  async save() {
    return saveImpl();
  }
}

mock.module("anki-apkg-export", {
  defaultExport: {
    Exporter: MockExporter,
    default: (_deckName: string, _template: any) => new MockExporter(_deckName, _template),
  },
});

// Mock template loaders and fs so generator doesn't read real files
const mockTemplate = {
  loadFrontHtml: () => "<div>front</div>",
  loadBackHtml: () => "<div>back</div>",
  loadCss: () => "body{}",
  createAnkiTemplate: () => "PRAGMA foreign_keys=OFF;",
  SEPARATOR,
};

mock.module("../../src/core/template.js", {
  namedExports: mockTemplate,
  defaultExport: mockTemplate,
});

const mockFs = {
  writeFileSync: () => {},
  readFileSync: () => Buffer.from("data"),
  existsSync: () => false,
  mkdirSync: () => {},
};

mock.module("node:fs", {
  namedExports: mockFs,
  defaultExport: mockFs,
});

const mockEnv = {
  ROOT: "/tmp",
  MEDIA_DIR: "/tmp/media",
  IMAGE_DIR: "/tmp/media",
};

mock.module("../../src/config/env.js", {
  namedExports: mockEnv,
  defaultExport: mockEnv,
});

const { generateApkg } = await import("../../src/core/generator.js");

// ─── Mock parser cơ bản ─────────────────────────────────────────────────────
function makeParser(fields: readonly string[], templateName = "vocab"): BaseParser {
  return {
    getFieldNames: () => fields,
    getTemplateName: () => templateName,
    parse: async () => ({ cards: [], media: [] }),
  } as unknown as BaseParser;
}

function resetCalls() {
  addMediaCalls = [];
  addCardCalls = [];
  saveImpl = async () => Buffer.from("zip");
}

describe("generator.ts: generateApkg", () => {
  test("addMedia được gọi đúng số lần cho mỗi asset", async () => {
    resetCalls();
    const result: ParsedResult = {
      cards: [],
      media: [
        { filename: "a.mp3", buffer: Buffer.from("a") },
        { filename: "b.jpg", buffer: Buffer.from("b") },
      ],
    };
    await generateApkg(result, makeParser(["Word"]), "TestDeck");
    assert.strictEqual(addMediaCalls.length, 2);
    assert.strictEqual(addMediaCalls[0][0], "a.mp3");
    assert.strictEqual(addMediaCalls[1][0], "b.jpg");
  });

  test("addCard được gọi đúng số lần cho mỗi card", async () => {
    resetCalls();
    const FIELDS = ["A", "B", "C"] as const;
    const result: ParsedResult = {
      cards: [
        { frontKeyField: "front1", fields: { A: "1", B: "2", C: "3" } },
        { frontKeyField: "front2", fields: { A: "x", B: "y", C: "z" } },
        { frontKeyField: "front3", fields: { A: "p", B: "q", C: "r" } },
      ],
      media: [],
    };
    await generateApkg(result, makeParser(FIELDS), "TestDeck");
    assert.strictEqual(addCardCalls.length, 3);
  });

  test("thứ tự field trong back khớp với FIELD_NAMES", async () => {
    resetCalls();
    const FIELDS = ["A", "B", "C"] as const;
    const result: ParsedResult = {
      cards: [{ frontKeyField: "front", fields: { C: "3", A: "1", B: "2" } }],
      media: [],
    };
    await generateApkg(result, makeParser(FIELDS), "TestDeck");
    // front should be A ("1")
    assert.strictEqual(addCardCalls[0][0], "1");
    // back should be B + SEP + C
    assert.strictEqual(addCardCalls[0][1], `2${SEPARATOR}3`);
  });

  test("field thiếu → thay bằng chuỗi rỗng", async () => {
    resetCalls();
    const FIELDS = ["A", "B", "C"] as const;
    const result: ParsedResult = {
      cards: [{ frontKeyField: "front", fields: { A: "1", C: "3" } }],
      media: [],
    };
    await generateApkg(result, makeParser(FIELDS), "TestDeck");
    // front should be A ("1")
    assert.strictEqual(addCardCalls[0][0], "1");
    // back should be B (missing -> "") + SEP + C ("3")
    assert.strictEqual(addCardCalls[0][1], `${SEPARATOR}3`);
  });

  test("save() throw → generateApkg rethrow đúng error", async () => {
    resetCalls();
    saveImpl = async () => {
      throw new Error("disk full");
    };
    const result: ParsedResult = { cards: [], media: [] };
    await assert.rejects(() => generateApkg(result, makeParser(["A"]), "TestDeck"), /disk full/);
  });
});
