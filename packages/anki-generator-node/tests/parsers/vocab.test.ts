import { test, describe, mock, beforeEach } from "node:test";
import assert from "node:assert";

// ─── Mock audio and image modules before importing parser ───────────────────
const mockDownloadAudio = mock.fn(async (_word: string, _filename: string) => false);
const mockDownloadImage = mock.fn(async (_prompt: string, _filename: string) => false);

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
  readFileSync: (_p: string) => Buffer.from("fake-audio"),
  existsSync: () => false,
};
mock.module("node:fs", {
  namedExports: mockFs,
  defaultExport: mockFs,
});

const { VocabParser } = await import("../../src/parsers/vocab.js");

const VOCAB_ITEM = {
  word: "ameliorate",
  ipa: "/əˈmiːlɪəreɪt/",
  word_class: "verb",
  definition: "To make something bad less severe.",
  meaning_vn: "Cải thiện",
  meaning_jp: "改善する",
  example: "The government tried to ameliorate the situation.",
  example_vn: "Chính phủ cố cải thiện tình hình.",
  example_jp: "政府は状況を改善しようとした。",
  collocations: "ameliorate conditions, ameliorate suffering",
  image_prompt: "N/A",
};

describe("VocabParser", () => {
  beforeEach(() => {
    mockDownloadAudio.mock.resetCalls();
    mockDownloadImage.mock.resetCalls();
  });

  test("audio thất bại → Audio field rỗng, không thêm media", async () => {
    mockDownloadAudio.mock.mockImplementationOnce(async () => false);
    const parser = new VocabParser();
    const result = await parser.parse(JSON.stringify([VOCAB_ITEM]));
    assert.strictEqual(result.cards[0].fields["Audio"], "");
    assert.strictEqual(result.media.length, 0);
  });

  test("audio thành công → Audio field đúng format [sound:...]", async () => {
    mockDownloadAudio.mock.mockImplementationOnce(async () => true);
    const parser = new VocabParser();
    const result = await parser.parse(JSON.stringify([VOCAB_ITEM]));
    assert.strictEqual(result.cards[0].fields["Audio"], "[sound:ameliorate.mp3]");
  });

  test("image_prompt = 'N/A' → Image field rỗng", async () => {
    const parser = new VocabParser();
    const result = await parser.parse(JSON.stringify([VOCAB_ITEM]));
    assert.strictEqual(result.cards[0].fields["Image"], "");
  });

  test("word có khoảng trắng → audioFilename dùng dấu _", async () => {
    mockDownloadAudio.mock.mockImplementationOnce(async () => true);
    const parser = new VocabParser();
    const item = { ...VOCAB_ITEM, word: "phrasal verb" };
    const result = await parser.parse(JSON.stringify([item]));
    assert.strictEqual(result.cards[0].fields["Audio"], "[sound:phrasal_verb.mp3]");
  });

  test("definition chứa backtick → được convert sang <code>", async () => {
    const parser = new VocabParser();
    const item = { ...VOCAB_ITEM, definition: "Use `null` carefully." };
    const result = await parser.parse(JSON.stringify([item]));
    assert.ok(result.cards[0].fields["Definition"]?.includes("<code>null</code>"));
  });

  test("nhiều từ → trả về đúng số lượng cards", async () => {
    const parser = new VocabParser();
    const items = [
      VOCAB_ITEM,
      { ...VOCAB_ITEM, word: "mitigate" },
      { ...VOCAB_ITEM, word: "alleviate" },
    ];
    const result = await parser.parse(JSON.stringify(items));
    assert.strictEqual(result.cards.length, 3);
  });

  test("raw JSON trong code fence → được parse đúng", async () => {
    const parser = new VocabParser();
    const raw = "```json\n" + JSON.stringify([VOCAB_ITEM]) + "\n```";
    const result = await parser.parse(raw);
    assert.strictEqual(result.cards.length, 1);
    assert.strictEqual(result.cards[0].frontKeyField, "ameliorate");
  });

  test("image_prompt hợp lệ, download thành công → Image field có <img>", async () => {
    mockDownloadImage.mock.mockImplementationOnce(async () => true);
    const parser = new VocabParser();
    const item = { ...VOCAB_ITEM, image_prompt: "a beautiful landscape" };
    const result = await parser.parse(JSON.stringify([item]));
    assert.ok(result.cards[0].fields["Image"]?.startsWith("<img"));
  });
});
