import test from "node:test";
import assert from "node:assert/strict";
import { JpVocabParser } from "../src/parsers/jp_vocab.js";

test("JpVocabParser parses single JSON item correctly", async () => {
  const jsonStr = JSON.stringify([
    {
      meta: { jlpt_level: "N3", tags: ["immersion"] },
      vocabulary: {
        kanji_expression: "閉める",
        kana_reading: "しめる",
        furigana_format: "閉[し]める",
        pitch_accent: "2",
        part_of_speech: "Động từ nhóm 2",
        meaning_vi: "Đóng (cửa, ví...)",
      },
      context: {
        sentence_jp: "寒いので窓を閉めてください。",
        sentence_furigana: "寒[さむ]いので 窓[まど]を 閉[し]めてください。",
        sentence_translation: "Vì trời lạnh nên xin vui lòng đóng cửa sổ lại.",
        cloze_front: "寒いので窓を {{c1::閉めて}} ください。",
      },
      media: {
        word_audio: "",
        sentence_audio: "",
        image_hint: "",
      },
      notes: { mnemonic: "Kanji 閉 (BẾ)...", nuance: "Phân biệt với 閉まる" },
    },
  ]);

  const parser = new JpVocabParser();
  const result = await parser.parse(jsonStr);

  assert.equal(result.cards.length, 1);
  const fields = result.cards[0].fields;
  assert.equal(fields.Kanji_Expression, "閉める");
  assert.ok(fields.Furigana_HTML.includes("<ruby>閉<rt>し</rt></ruby>"));
  assert.equal(fields.Pitch_Accent, "2");
  assert.equal(fields.JLPT_Level, "N3");
});
