import { test, describe } from "node:test";
import assert from "node:assert";
import { BasicParser } from "../../src/parsers/basic.js";

const BASIC_ITEM = {
  front: "Front content with `inline code`",
  back: "Back content with\nnewline",
};

describe("BasicParser", () => {
  test("phân tích đúng cấu trúc front và back", async () => {
    const parser = new BasicParser();
    const result = await parser.parse(JSON.stringify([BASIC_ITEM]));

    assert.strictEqual(result.cards.length, 1);
    assert.strictEqual(result.cards[0].frontKeyField, BASIC_ITEM.front);
    assert.ok(result.cards[0].fields["Front"].includes("<code>inline code</code>"));
    assert.ok(result.cards[0].fields["Back"].includes("Back content with<br>newline"));
    assert.strictEqual(result.media.length, 0);
  });
});
