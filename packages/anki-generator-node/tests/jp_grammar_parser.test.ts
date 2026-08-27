import test from "node:test";
import assert from "node:assert/strict";
import { JpGrammarParser } from "../src/parsers/jp_grammar.js";

test("JpGrammarParser parses single Japanese grammar item correctly", async () => {
  const jsonStr = JSON.stringify([
    {
      meta: { jlpt_level: "N4", tags: ["grammar", "N4"] },
      grammar: {
        pattern: "〜てから",
        reading: "てから",
        formula: "V-て + から",
        meaning_vi: "Sau khi làm V1 thì làm V2",
        meaning_jp: "V1の動作が完了した後に、V2の動作を行うことを表す。",
        explanation: "Diễn tả thứ tự hành động.",
      },
      example: {
        sentence_jp: "ご飯を食べてから、歯を磨きます。",
        sentence_furigana: "御飯[ごはん]を 食[た]べてから、 歯[は]を 磨[みが]きます。",
        sentence_translation: "Sau khi ăn cơm xong thì tôi đánh răng.",
      },
      notes: {
        usage_notes: "Khác với 〜あとで.",
        related_grammar: "〜あとで",
      },
    },
  ]);

  const parser = new JpGrammarParser();
  const result = await parser.parse(jsonStr);

  assert.equal(result.cards.length, 1);
  const fields = result.cards[0].fields;
  assert.equal(fields.Pattern, "〜てから");
  assert.equal(fields.Reading, "てから");
  assert.ok(fields.Sentence_Furigana_HTML.includes("<ruby>御飯<rt>ごはん</rt></ruby>"));
  assert.equal(fields.JLPT_Level, "N4");
});

test("JpGrammarParser handles patterns with slashes safely without path errors", async () => {
  const jsonStr = JSON.stringify([
    {
      grammar: {
        pattern: "される / られる (Thể bị động)",
        reading: "される / られる",
        formula: "Verb + される/られる",
        meaning_vi: "Thể bị động",
      },
      example: {
        sentence_jp: "先生にほめられました。",
      },
    },
  ]);

  const parser = new JpGrammarParser();
  const result = await parser.parse(jsonStr);

  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].fields.Pattern, "される / られる (Thể bị động)");
});
