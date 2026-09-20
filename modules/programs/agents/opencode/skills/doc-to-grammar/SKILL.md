---
name: doc-to-grammar
description: >-
  Convert English grammar rules, notes, structures, or textbooks into structured JSON grammar flashcard data for Anki.
  Use this skill whenever the user provides English grammar patterns, tenses, clause structures, or asks to generate English grammar flashcards (--type grammar).
  Triggers on Vietnamese phrases like "tạo flashcard ngữ pháp", "tạo thẻ ngữ pháp tiếng anh", "làm grammar anki", "tạo mẫu câu ngữ pháp", "chuyển lý thuyết ngữ pháp thành anki".
---

# Doc to Grammar Flashcard

Convert English grammar rules, syntactic structures, or textbook notes into a structured JSON array conforming to the `GrammarItem` schema for use with `--type grammar` in the `anki-generator-node` project.

When compiled with `anki-tool --type grammar <input.json>`, the tool automatically:
- Generates and downloads pronunciation audio for the grammar pattern (`downloadAudio`).
- Generates or downloads illustration images if `image_prompt` is provided (`downloadImage`).
- Renders formulas, explanations, and usage notes into formatted HTML.

---

## When Triggered

When the user provides grammar notes, textbook explanations, or requests grammar flashcards:

1. **Extract Core Grammar Points**:
   - **Pattern**: The name or formula of the pattern (e.g. `"Not only... but also..."`, `"Third Conditional"`, `"Cleft Sentences"`).
   - **Formula**: Clear syntactic template (e.g. `"Not only + Auxiliary + S + V, but S + also + V"`).

2. **Formulate Explanations & Context**:
   - **Explanation**: Comprehensive, clear English explanation of when and why the grammar is used.
   - **Meanings**:
     - `meaning_vn`: Precise Vietnamese translation and grammatical function.
     - `meaning_jp`: Japanese translation / explanation of the grammatical function.
   - **Examples**:
     - `example`: Natural sentence clearly illustrating the pattern (highlight pattern with `**bold**`).
     - `example_vn`: Vietnamese translation.
     - `example_jp`: Japanese translation.
   - **Usage Notes**: Nuances, common errors, inversion constraints, formal vs informal registers.
   - **Image Prompt** *(Optional)*: Visual prompt illustrating the example situation or action, or `"N/A"`.

3. **Output Strict Valid JSON**:
   - Output must be a top-level JSON array `[...]`.

---

## Schema & Output Format

```typescript
interface GrammarItem {
  pattern: string; // The grammar pattern name or key phrase (e.g. "Hardly had... when...")
  formula: string; // Grammatical formula (e.g. "Hardly had + S + V3/ed + when + S + V2/ed")
  explanation: string; // Detailed English explanation of usage & nuance
  meaning_vn: string; // Meaning / translation in Vietnamese
  meaning_jp: string; // Meaning / translation in Japanese
  example: string; // Natural example sentence (markdown supported)
  example_vn: string; // Vietnamese translation of the example
  example_jp: string; // Japanese translation of the example
  usage_notes: string; // Crucial notes: common traps, register, inversions
  image_prompt?: string; // Optional image generation prompt or "N/A"
}
```

### JSON Example

```json
[
  {
    "pattern": "Not only... but also... (Inversion)",
    "formula": "Not only + Auxiliary / Modal + S + V, but S + also + V",
    "explanation": "Used for dramatic emphasis when adding a second, often more surprising point. When 'Not only' is placed at the beginning of a clause, negative inversion (subject-auxiliary inversion) is strictly required in the first clause.",
    "meaning_vn": "Không những... mà còn... (Đảo ngữ nhấn mạnh khi 'Not only' đứng đầu câu)",
    "meaning_jp": "〜だけでなく、…もまた（倒置構文による強調）",
    "example": "**Not only did she win** the marathon, **but she also** broke the world record.",
    "example_vn": "Cô ấy không những đã chiến thắng cuộc đua marathon mà còn phá vỡ kỷ lục thế giới.",
    "example_jp": "彼女はマラソンで優勝しただけでなく、世界記録も破った。",
    "usage_notes": "• Inversion only occurs in the clause introduced by 'Not only'. The second clause retains standard S + V order.\n• 'also' can sometimes be placed at the end as 'as well' or omitted in informal writing.",
    "image_prompt": "A female athlete victoriously crossing the marathon finish ribbon while glancing back at a giant digital timer showing a world record, cheering crowd"
  },
  {
    "pattern": "Wish + Past Perfect",
    "formula": "S + wish + (that) + S + had + V3/ed",
    "explanation": "Used to express regret about past actions, decisions, or events that did not happen or happened differently than desired.",
    "meaning_vn": "Ước một điều trái với thực tế trong quá khứ (diễn tả sự hối tiếc)",
    "meaning_jp": "過去の事実に反する後悔・願望（〜していればよかったのに）",
    "example": "I **wish I had accepted** that job offer when I had the chance.",
    "example_vn": "Tôi ước gì mình đã chấp nhận lời mời làm việc đó khi còn có cơ hội.",
    "example_jp": "機会があったときに、その求人を受け入れていればよかったのにと思う。",
    "usage_notes": "• Often accompanied by 'if only' (e.g. 'If only I had listened...').\n• Cannot be used to express wishes about the present or future (use Simple Past or 'would' instead).",
    "image_prompt": "A thoughtful man standing at a misty train station platform looking at an old train ticket in his hand, nostalgic mood"
  }
]
```

---

## Quality Checklist

- [ ] Top-level element is a JSON array `[...]`.
- [ ] Required fields (`pattern`, `formula`, `explanation`, `meaning_vn`, `meaning_jp`, `example`, `example_vn`, `example_jp`, `usage_notes`) are present.
- [ ] Formula is clear with capitalized placeholders (`S`, `V`, `Auxiliary`, `V3/ed`).
- [ ] Key pattern in `example` is highlighted with `**bold**`.

---

## Compilation Command

To compile into an Anki `.apkg` deck:

```bash
# Standard compilation
anki-tool --type grammar <output.json>

# With custom deck name
anki-tool --type grammar --deck-name "English::Advanced Grammar" <output.json>
```
