---
name: anki-jp-grammar-generator
description: Generate structured Japanese Anki grammar card JSON data for anki-generator-node (`--type jp_grammar`). ALWAYS use when user asks to create Japanese grammar Anki flashcards, generate Japanese grammar cards, or needs structured Japanese JSON with pattern, reading, formula, 3-language translations (VI, EN, JP), example sentence with furigana, usage notes, and JLPT levels. Handles N5, N4, N3, N2, N1 grammar points. Output JSON array has fields matching the schema (meta, grammar, example, media, notes). Vietnamese triggers: "tạo thẻ ngữ pháp tiếng Nhật", "tạo Anki ngữ pháp tiếng Nhật", "tạo json ngữ pháp", "ngữ pháp tiếng Nhật", "anki jp grammar", "jp grammar json", "tạo thẻ jp_grammar".
---

# Japanese Grammar Card Generator (Schema `jp_grammar`)

Generate clean, structured JSON arrays for Japanese grammar cards according to the **Japanese Grammar Anki Format**, designed to compile with `anki-generator-node` using `--type jp_grammar`.

## Key Highlights of this Schema

1. **Multi-language Support**: Supports Vietnamese (`meaning_vi`), English (`meaning_en`), and Japanese (`meaning_jp`) definitions and example translations.
2. **Formula & Conjugation**: Explicitly specifies pattern breakdown & conjugation rules (`formula`).
3. **Contextual Sentence & Furigana**: Example sentence formatted with bracket furigana `漢字[かんじ]` for native ruby markup in Anki.
4. **Usage Notes & Nuance**: Clear differentiation between similar grammar points (e.g. `〜てから` vs `〜あとで`).

## Output JSON Schema

ALWAYS output valid JSON array formatted strictly as follows:

```json
[
  {
    "meta": {
      "jlpt_level": "N4",
      "tags": ["grammar", "N4", "DoJG"]
    },
    "grammar": {
      "pattern": "〜てから",
      "reading": "てから",
      "formula": "V-て + から",
      "meaning_vi": "Sau khi làm V1 thì làm V2",
      "meaning_en": "After doing V1, do V2",
      "meaning_jp": "V1の動作が完了した後に、V2の動作を行うことを表す。",
      "explanation": "Diễn tả hành động V1 hoàn thành xong rồi mới đến V2, nhấn mạnh thứ tự trước sau rõ ràng."
    },
    "example": {
      "sentence_jp": "ご飯を食べてから、歯を磨きます。",
      "sentence_furigana": "御飯[ごはん]を 食[た]べてから、 歯[は]を 磨[みが]きます。",
      "sentence_translation_vi": "Sau khi ăn cơm xong thì tôi đánh răng.",
      "sentence_translation_en": "After eating a meal, I brush my teeth."
    },
    "media": {
      "pattern_audio": "",
      "sentence_audio": "",
      "image_hint": ""
    },
    "notes": {
      "usage_notes": "Khác với 〜あとで, 〜てから nhấn mạnh V1 là điều kiện bắt buộc/tiền đề để thực hiện V2.",
      "usage_notes_en": "Unlike 〜あとで, 〜てから emphasizes that V1 is a prerequisite for V2.",
      "related_grammar": "〜あとで (Sau khi...)"
    }
  }
]
```

## Guidelines for Content Generation

1. **`media` fields (`pattern_audio`, `sentence_audio`, `image_hint`)**: Leave as empty strings `""` by default during JSON generation. The `anki-generator-node` compiler automatically generates Japanese TTS audio for the grammar pattern & example sentence during APKG compilation.
2. **`sentence_furigana`**: Use standard Anki bracket notation: `Kanji[Furigana]` (e.g., `御飯[ごはん]`, `食[た]べてから`).
3. **`formula`**: Use clear markdown notation for verb/adjective/noun conjugations (e.g., `V-て + から`, `V-た / V-ない + ほうがいい`, `N + にとって`).
4. **`meaning_vi` & `meaning_en`**: Provide clear, concise translations in Vietnamese and English.
5. **`notes`**: Highlight usage warnings, common pitfalls, and contrast with similar grammar patterns.

## CLI Usage

Save the generated JSON file (e.g., `grammar_jp.json`) and compile it using `anki-generator-node`:

```bash
# Compile to APKG package
node dist/index.js --type jp_grammar grammar_jp.json
```
