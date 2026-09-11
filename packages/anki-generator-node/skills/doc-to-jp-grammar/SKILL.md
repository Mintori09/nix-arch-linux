---
name: doc-to-jp-grammar
description: >-
  Convert Japanese grammar points, JLPT Bunpou notes, or lesson materials into structured JSON grammar flashcard data for Anki (--type jp_grammar).
  Use this skill whenever the user provides Japanese grammar patterns, JLPT N5-N1 structures, sentence formulas, or asks to generate Japanese grammar cards.
  Supports pattern name, reading, formula, trilingual meanings (VI/EN/JP), Furigana sentence examples (Kanji[furigana]), usage notes, and JLPT levels.
  Triggers on Vietnamese phrases like "tạo flashcard ngữ pháp tiếng nhật", "tạo thẻ bunpou", "làm jp grammar anki", "tạo ngữ pháp jlpt", "chuyển ngữ pháp tiếng nhật thành anki".
---

# Doc to Japanese Grammar Flashcard

Convert Japanese grammar rules, JLPT Bunpou patterns (N5 to N1), or textbook notes into a structured JSON array conforming to the `JpGrammarItem` schema for use with `--type jp_grammar` in the `anki-generator-node` project.

When compiled with `node dist/index.js --type jp_grammar <input.json>`, the tool automatically:
- Synthesizes and downloads Japanese TTS audio for both the grammar pattern reading and the example sentence (`downloadAudio(..., "ja")`).
- Converts bracket-style Furigana (e.g. `漢字[かんじ]`) into valid HTML `<ruby>` tags.
- Renders Markdown formulas, explanations, and usage notes into HTML.
- Attaches image hints if provided.

---

## Furigana Formatting Rule

The parser automatically converts `Kanji[furigana]` into HTML `<ruby>Kanji<rt>furigana</rt></ruby>`.
Always write Kanji with brackets right after each kanji compound:
- Pattern reading or example sentence: `雨[あめ]が 降[ふ]る` or `食[た]べ 次第[しだい]`
- Sentence: `田中[たなか]さんが 来[き] 次第[しだい]、 会議[かいぎ]を 始[はじ]めます。`

---

## When Triggered

When the user provides Japanese grammar notes or asks for JLPT Bunpou flashcards:

1. **Grammar Core & Structure**:
   - `grammar.pattern`: Grammar pattern name (e.g. `〜次第`, `〜わけにはいかない`, `〜に相違ない`).
   - `grammar.reading`: Kana reading of the pattern (e.g. `しだい`, `わけにはいかない`, `にそういない`) for Japanese TTS pronunciation.
   - `grammar.formula`: Connection rules (e.g. `V-stem + 次第`, `V-dict / V-ない + わけにはいかない`).
   - `grammar.meaning_vi`: Clear Vietnamese meaning and condition.
   - `grammar.meaning_en` / `grammar.meaning_jp`: English / Japanese summary of meaning.
   - `grammar.explanation`: Detailed explanation of nuance, speaker intention, and constraints.

2. **Context & Example**:
   - `example.sentence_jp`: Natural Japanese example sentence.
   - `example.sentence_furigana`: Sentence with `Kanji[furigana]` formatting.
   - `example.sentence_translation`: Vietnamese translation of the example sentence.
   - `example.sentence_translation_en` *(Optional)*: English translation.

3. **Usage Notes & Metadata**:
   - `notes.usage_notes`: Crucial rules, common errors, spoken vs written nuance, restrictions (e.g. "không dùng với quá khứ", "vế sau không thể hiện ý chí").
   - `notes.related_grammar`: Similar or confusable patterns (e.g. `〜たらすぐ`, `〜が早いか`).
   - `meta.jlpt_level`: `N1`, `N2`, `N3`, `N4`, or `N5`.
   - `meta.tags`: Tags array (e.g. `["JLPT_N2", "Condition", "Time"]`).

---

## Schema & Output Format

```typescript
interface JpGrammarItem {
  meta?: {
    id?: string;
    jlpt_level?: "N1" | "N2" | "N3" | "N4" | "N5" | string;
    tags?: string[];
  };
  grammar: {
    pattern: string; // e.g. "〜次第"
    reading?: string; // e.g. "しだい"
    formula: string; // Connection rule: "V[masu-stem] + 次第"
    meaning_vi: string; // Vietnamese meaning
    meaning_en?: string;
    meaning_jp?: string;
    explanation?: string; // Nuance and detailed explanation
  };
  example?: {
    sentence_jp?: string;
    sentence_furigana?: string; // with Kanji[furigana] syntax
    sentence_translation?: string; // Vietnamese translation
    sentence_translation_en?: string;
  };
  media?: {
    pattern_audio?: string; // Leave empty for auto TTS
    sentence_audio?: string;
    image_hint?: string;
  };
  notes?: {
    usage_notes?: string;
    usage_notes_en?: string;
    related_grammar?: string;
  };
}
```

### JSON Example

```json
[
  {
    "meta": {
      "jlpt_level": "N2",
      "tags": ["JLPT_N2", "Time_Sequence", "Formal"]
    },
    "grammar": {
      "pattern": "〜次第",
      "reading": "しだい",
      "formula": "V (bỏ ます) + 次第",
      "meaning_vi": "Ngay sau khi... thì sẽ... (chỉ hành động tiếp theo diễn ra lập tức)",
      "meaning_en": "As soon as..., immediately after...",
      "meaning_jp": "〜したらすぐ、〜の完了後ただちに",
      "explanation": "Diễn tả một hành động hoặc sự việc sẽ được thực hiện ngay lập tức sau khi hành động trước kết thúc. Mang tính trang trọng, thường dùng trong công việc và email thương mại."
    },
    "example": {
      "sentence_jp": "詳しい日程が決まり次第、改めてご連絡いたします。",
      "sentence_furigana": "詳[くわ]しい 日程[にってい]が 決[き]まり 次第[しだい]、 改[あらた]めて ご 連絡[れんらく]いたします。",
      "sentence_translation": "Ngay sau khi lịch trình cụ thể được quyết định, tôi sẽ liên hệ lại với quý vị."
    },
    "notes": {
      "usage_notes": "• Vế sau KHÔNG dùng cho việc trong quá khứ (không dùng dạng 〜た).\n• Vế sau thường thể hiện ý chí, quyết định, lời yêu cầu hoặc thông báo của người nói (〜ます, 〜いたします, 〜てください).\n• Trang trọng hơn '〜たらすぐ'.",
      "related_grammar": "〜たとたん, 〜次第で (phụ thuộc vào)"
    }
  },
  {
    "meta": {
      "jlpt_level": "N1",
      "tags": ["JLPT_N1", "Strong_Denial", "Emphasis"]
    },
    "grammar": {
      "pattern": "〜てやまない",
      "reading": "てやまない",
      "formula": "V-て + やまない",
      "meaning_vi": "Hết sức..., vô cùng..., không ngừng... (tận đáy lòng)",
      "meaning_en": "Deeply, sincerely, never stop (hoping, wishing, loving)",
      "meaning_jp": "心から強く〜し続けている",
      "explanation": "Dùng để nhấn mạnh tình cảm, cảm xúc hoặc lời cầu chúc mãnh liệt từ tận đáy lòng kéo dài liên tục."
    },
    "example": {
      "sentence_jp": "被災地の一日も早い復興を祈ってやまない。",
      "sentence_furigana": "被災地[ひさいち]の 一日[いちにち]も 早[はや]い 復興[ふっこう]を 祈[いの]ってやまない。",
      "sentence_translation": "Tôi không ngừng cầu nguyện cho vùng bị nạn sẽ phục hồi sớm dù chỉ một ngày."
    },
    "notes": {
      "usage_notes": "• Chỉ đi kèm với các động từ thể hiện cảm xúc, tâm trạng mạnh mẽ như: 祈る (cầu nguyện), 願う (mong ước), 愛する (yêu thương), 期待する (kỳ vọng).\n• Không dùng cho các trạng thái tình cảm nhất thời hay tiêu cực như giận dữ, căm ghét."
    }
  }
]
```

---

## Quality Checklist

- [ ] Top-level element is a JSON array `[...]`.
- [ ] `grammar` object contains `pattern`, `formula`, `meaning_vi`.
- [ ] `pattern` clean without tildes in `reading` so TTS reads clearly (e.g. `しだい` instead of `〜しだい`).
- [ ] Example sentences use `Kanji[furigana]` for all kanji tokens.
- [ ] `usage_notes` explicitly point out key grammar traps (tense constraints, subject constraints, register).

---

## Compilation Command

To compile into an Anki `.apkg` deck:

```bash
# Basic compilation (auto generates Japanese audio TTS)
node dist/index.js --type jp_grammar <output.json>

# With custom deck name
node dist/index.js --type jp_grammar --deck-name "Japanese::JLPT N2 Grammar" <output.json>
```
