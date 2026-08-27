import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

test("CLI generates .apkg for jp_vocab payload", () => {
  const sampleJson = path.join(process.cwd(), "tests/fixtures/sample_jp_vocab.json");
  const outputApkg = path.join(process.cwd(), "tests/fixtures/sample_jp_vocab.apkg");

  if (!fs.existsSync(path.dirname(sampleJson))) {
    fs.mkdirSync(path.dirname(sampleJson), { recursive: true });
  }

  fs.writeFileSync(
    sampleJson,
    JSON.stringify([
      {
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
      },
    ]),
  );

  execSync(`node --import tsx src/index.ts --type jp_vocab ${sampleJson}`);
  assert.ok(fs.existsSync(outputApkg));

  // cleanup
  if (fs.existsSync(sampleJson)) fs.unlinkSync(sampleJson);
  if (fs.existsSync(outputApkg)) fs.unlinkSync(outputApkg);
});
