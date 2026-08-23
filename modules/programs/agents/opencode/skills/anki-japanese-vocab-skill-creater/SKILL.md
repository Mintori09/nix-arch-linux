---
name: anki-jp-vocab-generator
description: Generate structured 2026-optimized Japanese Anki vocabulary card JSON data for anki-generator-node (`--type jp_vocab`). ALWAYS use when user asks to create Japanese Anki flashcards, generate Japanese vocabulary cards, or needs structured Japanese JSON with furigana, pitch accent, sentence mining (N+1), cloze deletion, and Vietnamese translation. Handles single words, verbs (transitive/intransitive), idioms, and phrases. Output JSON array has fields matching the 2026 optimized schema (meta, vocabulary, context, media, notes). Vietnamese triggers: "tạo thẻ tiếng Nhật", "tạo Anki tiếng Nhật", "tạo json tiếng Nhật", "anki jp", "jp vocab json", "từ mới tiếng Nhật".
---

# Japanese Vocabulary Card Generator (2026 Optimized Schema)

Generate clean, structured JSON arrays for Japanese vocabulary cards according to the **2026 Optimized Japanese Anki Format**, designed to solve:

1. **Context Trap**: Separate Kanji expression from Furigana so front cards enforce real Kanji recognition.
2. **Pitch Accent**: Provide standard numeric pitch accent tags (e.g. `0`, `1`, `2`) to foster natural native pronunciation.
3. **N+1 Sentence Mining**: Provide example sentences containing exactly 1 new target word, plus cloze deletion syntax `{{c1::...}}`.

## Output JSON Schema

ALWAYS output valid JSON array formatted strictly as follows:

```json
[
  {
    "meta": {
      "id": "jp_vocab_001",
      "jlpt_level": "N3",
      "frequency_rank": 1420,
      "tags": ["immersion", "verb"]
    },
    "vocabulary": {
      "kanji_expression": "閉める",
      "kana_reading": "しめる",
      "furigana_format": "閉[し]める",
      "pitch_accent": "2",
      "pitch_graph_url": "",
      "part_of_speech": "Động từ nhóm 2 (Tha động từ)",
      "meaning_vi": "Đóng (cửa, ví...)"
    },
    "context": {
      "sentence_jp": "寒いので窓を閉めてください。",
      "sentence_furigana": "寒[さむ]いので 窓[まど]を 閉[し]めてください。",
      "sentence_translation": "Vì trời lạnh nên xin vui lòng đóng cửa sổ lại.",
      "cloze_front": "寒いので窓を {{c1::閉めて}} ください。"
    },
    "media": {
      "word_audio": "",
      "sentence_audio": "",
      "image_hint": ""
    },
    "notes": {
      "mnemonic": "Kanji 閉 (BẾ) gồm bộ Môn 門 (cửa) và chữ Tài 才. Muốn ĐÓNG cửa cần có TÀI.",
      "nuance": "Phân biệt với 閉まる (Tự động từ - Cửa tự đóng)."
    }
  }
]
```

## Guidelines for Content Generation

1. **`media` fields (`word_audio`, `sentence_audio`, `image_hint`)**: Leave as empty strings `""` by default during JSON generation. The `anki-generator-node` build system dynamically generates TTS audio files and downloads image hints automatically during package compilation.
2. **`furigana_format` & `sentence_furigana`**: Use standard Anki bracket notation: `Kanji[Furigana]` (e.g., `閉[し]める`, `寒[さむ]い`).
3. **`pitch_accent`**: Numeric pattern indicator (e.g. `0` for Heiban, `1` for Atamadaka, `2` for Nakadaka, etc.).
4. **`part_of_speech`**: Include clear classification in Vietnamese (e.g., `Động từ nhóm 1 (Tự động từ)`, `Danh từ`, `Tính từ -i`).
5. **`cloze_front`**: Use `{{c1::target_conjugated_word}}` inside `cloze_front` so Anki generates fill-in-the-blank cards cleanly.
6. **`meaning_vi` & `sentence_translation`**: Provide natural, accurate Vietnamese translations.
7. **`notes`**: Include mnemonic kanji breakdowns or transitive/intransitive (`自/他`) nuance notes where appropriate.

## CLI Usage

Save the generated JSON file (e.g., `vocab_jp.json`) and run `anki-generator-node`:

```bash
npx tsx src/index.ts --type jp_vocab vocab_jp.json
```
