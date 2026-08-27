import test from "node:test";
import assert from "node:assert/strict";
import { validateJsonStructure, convertFuriganaToHtml } from "../src/utils/helpers.js";

test("validateJsonStructure accepts valid jp_vocab array", () => {
  const validData = [
    {
      meta: { id: "jp_vocab_2026_001", jlpt_level: "N3" },
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
      media: { word_audio: "", sentence_audio: "", image_hint: "" },
      notes: { mnemonic: "Kanji 閉..." },
    },
  ];

  assert.doesNotThrow(() => validateJsonStructure(validData, "jp_vocab"));
});

test("convertFuriganaToHtml converts bracket furigana to ruby HTML", () => {
  const input = "寒[さむ]いので 窓[まど]を 閉[し]めてください。";
  const expected =
    "<ruby>寒<rt>さむ</rt></ruby>いので <ruby>窓<rt>まど</rt></ruby>を <ruby>閉<rt>し</rt></ruby>めてください。";
  assert.equal(convertFuriganaToHtml(input), expected);
});
