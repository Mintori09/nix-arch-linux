import { test, describe, mock, beforeEach } from "node:test";
import assert from "node:assert";

const mockDownloadAudio = mock.fn(async () => false);
const mockDownloadImage = mock.fn(async () => false);

const mockAudio = {
  downloadAudio: mockDownloadAudio,
  sanitizeFilename: (f: string) => f.replace(/[/\\?%*:|"<>]/g, "_"),
};
mock.module("../../src/core/audio.js", {
  namedExports: mockAudio,
  defaultExport: mockAudio,
});
const mockImage = {
  downloadImage: mockDownloadImage,
  promptToFilename: (p: string) => p.slice(0, 20).replace(/\s+/g, "_") + ".jpg",
};
mock.module("../../src/core/image.js", {
  namedExports: mockImage,
  defaultExport: mockImage,
});
const mockEnv = {
  ROOT: "/tmp",
  MEDIA_DIR: "/tmp/anki-test-media",
  IMAGE_DIR: "/tmp/anki-test-media",
};
mock.module("../../src/config/env.js", {
  namedExports: mockEnv,
  defaultExport: mockEnv,
});
const mockFs = {
  readFileSync: () => Buffer.from("fake-audio"),
  existsSync: () => false,
};
mock.module("node:fs", {
  namedExports: mockFs,
  defaultExport: mockFs,
});

const { GrammarParser } = await import("../../src/parsers/grammar.js");

const GRAMMAR_ITEM = {
  pattern: "~たばかり",
  formula: "Verb た-form + ばかり",
  explanation: "Used to indicate that an action was just completed.",
  meaning_vn: "Vừa mới làm gì đó",
  meaning_jp: "〜したばかり",
  example: "日本に来たばかりです。",
  example_vn: "Tôi vừa mới đến Nhật.",
  example_jp: "日本に来たばかりです。",
  usage_notes: "Connect to verb た-form only.",
  image_prompt: "N/A",
};

describe("GrammarParser", () => {
  beforeEach(() => {
    mockDownloadAudio.mock.resetCalls();
    mockDownloadImage.mock.resetCalls();
  });

  test("WordClass luôn là 'grammar'", async () => {
    const parser = new GrammarParser();
    const result = await parser.parse(JSON.stringify([GRAMMAR_ITEM]));
    assert.strictEqual(result.cards[0].fields["WordClass"], "grammar");
  });

  test("Collocations map từ usage_notes", async () => {
    const parser = new GrammarParser();
    const result = await parser.parse(JSON.stringify([GRAMMAR_ITEM]));
    assert.ok(result.cards[0].fields["Collocations"]?.includes("verb た-form only"));
  });

  test("audio thất bại → Audio field rỗng", async () => {
    const parser = new GrammarParser();
    const result = await parser.parse(JSON.stringify([GRAMMAR_ITEM]));
    assert.strictEqual(result.cards[0].fields["Audio"], "");
  });

  test("audio thành công → Audio field đúng format, pattern dùng _ thay khoảng trắng", async () => {
    mockDownloadAudio.mock.mockImplementationOnce(async () => true);
    const parser = new GrammarParser();
    const item = { ...GRAMMAR_ITEM, pattern: "verb form" };
    const result = await parser.parse(JSON.stringify([item]));
    assert.strictEqual(result.cards[0].fields["Audio"], "[sound:verb_form.mp3]");
  });

  test("explanation có block code → được convert sang <pre><code>", async () => {
    const parser = new GrammarParser();
    const item = {
      ...GRAMMAR_ITEM,
      explanation: "Example:\n```sql\nSELECT * FROM t;\n```",
    };
    const result = await parser.parse(JSON.stringify([item]));
    assert.ok(result.cards[0].fields["Definition"]?.includes("<pre><code"));
    assert.ok(result.cards[0].fields["Definition"]?.includes("SELECT * FROM t;"));
  });
});
