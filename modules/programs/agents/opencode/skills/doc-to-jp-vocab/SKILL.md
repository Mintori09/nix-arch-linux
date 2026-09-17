---
name: doc-to-jp-vocab
description: >-
  Convert Japanese vocabulary, JLPT study lists, or text passages into rich JSON flashcard data for Anki (--type jp_vocab).
  Use this skill whenever the user provides Japanese words, Kanji lists, JLPT N5-N1 vocabulary, or asks to generate Japanese vocab cards.
  Supports Kanji expression, Kana reading, bracket furigana formatting (漢字[かんじ]), pitch accent, example sentences, cloze deletion, and JLPT levels.
  Triggers on Vietnamese phrases like "tạo flashcard tiếng nhật", "tạo thẻ từ vựng tiếng nhật", "làm jp vocab anki", "tạo từ vựng jlpt", "chuyển kanji thành anki".
---

# Doc to Japanese Vocab Flashcard

Convert Japanese vocabulary notes, JLPT lists (N5 through N1), or reading excerpts into a structured JSON array conforming to the `JpVocabItem` schema for use with `--type jp_vocab` in the `anki-generator-node` project.

When compiled with `node dist/index.js --type jp_vocab <input.json>`, the tool automatically:
- Synthesizes and downloads Japanese TTS audio for the vocabulary word and the example sentence using Google TTS (`downloadAudio(..., "ja")`).
- Converts bracket-style Furigana (e.g. `私[わたし]`) into valid HTML `<ruby>` tags.
- Converts Markdown in meanings, nuances, and mnemonics into HTML.
- Generates or embeds image hints if provided.

---

## Furigana Formatting Rule

The parser automatically converts `Kanji[furigana]` into HTML `<ruby>Kanji<rt>furigana</rt></ruby>`.
Always write Kanji with brackets right after each kanji compound or character:
- Correct: `勉強[べんきょう]` or `食[た]べる`
- Sentence example: `毎日[まいにち] 日本語[にほんご]を 勉強[べんきょう]しています。`

---

## When Triggered

When the user provides Japanese words or study material:

1. **Vocabulary Extraction & Details**:
   - `kanji_expression`: Written form with Kanji or Katakana/Hiragana (e.g. `躊躇`, `食べる`, `パソコン`).
   - `kana_reading`: Full kana reading (e.g. `ちゅうちょ`, `たべる`, `ぱそこん`).
   - `furigana_format`: Bracket format (e.g. `躊躇[ちゅうちょ]`, `食[た]べる`).
   - `part_of_speech`: Word type (e.g. `名詞`, `動詞 (一段)`, `動詞 (五段)`, `い形容詞`, `な形容詞`, `副詞`).
   - `meaning_vi`: Natural Vietnamese translation.
   - `pitch_accent` *(Optional)*: Pitch accent notation (e.g. `[1] 頭高型`, `[0] 平板型`).

2. **Context & Sentences**:
   - `sentence_jp`: Plain Japanese sentence.
   - `sentence_furigana`: Sentence with `Kanji[furigana]` bracket formatting.
   - `sentence_translation`: Vietnamese translation of the sentence.
   - `cloze_front` *(Optional)*: Cloze sentence using Anki cloze syntax or blank placeholder `[...]`.

3. **Notes & Metadata**:
   - `mnemonic`: Bắt buộc xây dựng mẹo ghi nhớ sâu sắc theo cấu trúc:
     * **Phân tích bộ thủ / các nét cấu thành**: Tách chữ Hán thành các bộ thủ hoặc hình tượng nét vẽ cụ thể (tên Hán-Việt bộ thủ kèm ý nghĩa hình ảnh).
     * **Câu chuyện liên kết (Story)**: Xây dựng một câu chuyện ngắn gọn, sinh động, giàu hình ảnh hoặc cảm xúc kết nối các bộ phận lại với nghĩa của từ/chữ, giúp việc liên tưởng và học thuộc trở nên dễ dàng, tự nhiên.
   - `nuance`: Usage distinction, register (formal, spoken, written), or confusable words.
   - `meta.jlpt_level`: `N1`, `N2`, `N3`, `N4`, or `N5`.
   - `meta.tags`: Array of category tags (e.g. `["JLPT_N2", "Business", "Verb"]`).

---

## Schema & Output Format

```typescript
interface JpVocabItem {
  meta?: {
    id?: string;
    jlpt_level?: "N1" | "N2" | "N3" | "N4" | "N5" | string;
    frequency_rank?: number;
    tags?: string[];
  };
  vocabulary: {
    kanji_expression: string;
    kana_reading: string;
    furigana_format: string; // e.g. "躊躇[ちゅうちょ]" or "食[た]べる"
    pitch_accent?: string; // e.g. "[1] ①"
    pitch_graph_url?: string;
    part_of_speech: string; // e.g. "名詞・スル動詞"
    meaning_vi: string;
  };
  context?: {
    sentence_jp?: string;
    sentence_furigana?: string; // with Kanji[furigana] syntax
    sentence_translation?: string;
    cloze_front?: string;
  };
  media?: {
    word_audio?: string; // Optional custom audio or leave empty for auto TTS
    sentence_audio?: string;
    image_hint?: string; // Prompt string or filename
  };
  notes?: {
    mnemonic?: string;
    nuance?: string;
  };
}
```

### JSON Example

```json
[
  {
    "meta": {
      "jlpt_level": "N1",
      "tags": ["JLPT_N1", "Noun", "Suru_Verb"]
    },
    "vocabulary": {
      "kanji_expression": "躊躇",
      "kana_reading": "ちゅうちょ",
      "furigana_format": "躊躇[ちゅうちょ]",
      "pitch_accent": "[1] ① 頭高型",
      "part_of_speech": "名詞・スル動詞",
      "meaning_vi": "Do dự, ngập ngừng, lưỡng lự (chưa thể đưa ra quyết định ngay)"
    },
    "context": {
      "sentence_jp": "彼は危険を前にしても一瞬たりとも躊躇しなかった。",
      "sentence_furigana": "彼[かれ]は 危険[きけん]を 前[まえ]にしても 一瞬[いっしゅん]たりとも 躊躇[ちゅうちょ]しなかった。",
      "sentence_translation": "Trước hiểm nguy, anh ấy đã không hề do dự dù chỉ một khoảnh khắc.",
      "cloze_front": "彼[かれ]は 危険[きけん]を 前[まえ]にしても 一瞬[いっしゅん]たりとも [...]しなかった。"
    },
    "notes": {
      "mnemonic": "• Các bộ/nét cấu thành: Cả 2 chữ đều có bộ Túc (足 - chân). Chữ 躊 gồm Túc (足) + Thọ (寿 - trường thọ, già nua); chữ 躇 gồm Túc (足) + Trứ (著 - tỏ rõ, dừng lại).\n• Câu chuyện liên kết: Một người già lưng còng bước đi (chân + thọ) bỗng khựng chân lại dừng giữa đường (chân + trứ) vì phía trước có nguy hiểm nên ngập ngừng, lưỡng lự (躊躇 - do dự) không biết có nên bước tiếp.",
      "nuance": "Chỉ tâm lý chần chừ, do dự hành động. Thường dùng trang trọng trong văn viết; trong khẩu ngữ thường dùng 'ためらう'."
    },
    "media": {
      "image_hint": "A person standing at a fork in a misty mountain path hesitating which way to step, realistic painting"
    }
  },
  {
    "meta": {
      "jlpt_level": "N3",
      "tags": ["JLPT_N3", "Adjective_I"]
    },
    "vocabulary": {
      "kanji_expression": "悔しい",
      "kana_reading": "くやしい",
      "furigana_format": "悔[くや]しい",
      "pitch_accent": "[3] ③ 中高型",
      "part_of_speech": "い形容詞",
      "meaning_vi": "Tiếc nuối, tức tối, bực bội vì thất bại hoặc không đạt được kết quả mong đợi"
    },
    "context": {
      "sentence_jp": "試合に一点差で負けて、本当に悔しい。",
      "sentence_furigana": "試合[しあい]に 一点差[いってんさ]で 負[ま]けて、 本当[ほんとう]に 悔[くや]しい。",
      "sentence_translation": "Thua trận đấu chỉ vì cách biệt 1 điểm, thật sự vô cùng tiếc nuối và cay đắng."
    },
    "notes": {
      "mnemonic": "• Các bộ/nét cấu thành: Bộ Tâm đứng (忄- trái tim, cảm xúc) + chữ Mỗi (毎 - mỗi lần, mỗi ngày).\n• Câu chuyện liên kết: Mỗi lần (毎) nhớ lại thất bại hay sai lầm cũ, trái tim (忄) lại nhói đau và cay cú, cảm thấy vô cùng tiếc nuối (悔しい).",
      "nuance": "'悔しい' thể hiện cảm xúc tiếc nuối kèm cay cú, tức giận với bản thân vì đã để thua hoặc bỏ lỡ cơ hội."
    }
  }
]
```

---

## Quality Checklist

- [ ] Top-level element is a JSON array `[...]`.
- [ ] `vocabulary` object must contain: `kanji_expression`, `kana_reading`, `furigana_format`, `part_of_speech`, `meaning_vi`.
- [ ] Furigana uses bracket notation: `Kanji[kana]`, e.g. `勉強[べんきょう]`.
- [ ] `sentence_furigana` contains bracket furigana for all kanji words in the sentence.
- [ ] `notes.mnemonic` có phân tích chi tiết bộ thủ / nét vẽ cấu thành và câu chuyện liên tưởng sinh động, dễ nhớ.

---

## Compilation Command

To compile into an Anki `.apkg` deck:

```bash
# Basic compilation (auto generates Japanese audio via TTS)
node dist/index.js --type jp_vocab <output.json>

# With custom deck name
node dist/index.js --type jp_vocab --deck-name "Japanese::JLPT N1 Vocab" <output.json>
```
