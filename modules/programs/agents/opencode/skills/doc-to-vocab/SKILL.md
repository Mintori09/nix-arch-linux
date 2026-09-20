---
name: doc-to-vocab
description: >-
  Convert English vocabulary lists, texts, or documents into structured JSON vocabulary flashcard data for Anki.
  Use this skill whenever the user provides English words, vocabulary lists, reading passages, or asks to generate English vocab flashcards (--type vocab).
  Triggers on Vietnamese phrases like "tạo flashcard từ vựng", "tạo thẻ từ mới", "làm vocab anki", "tạo từ vựng tiếng anh", "chuyển list từ thành anki".
---

# Doc to Vocab Flashcard

Convert English vocabulary lists, notes, or reading materials into a structured JSON array conforming to the `VocabItem` schema for use with `--type vocab` in the `anki-generator-node` project.

When compiled with `anki-tool --type vocab <input.json>`, the tool automatically:
- Generates and downloads pronunciation audio for the word (`downloadAudio`).
- Automatically creates or fetches illustration images if `image_prompt` is provided (`downloadImage`).
- Formats markdown definitions and examples into rich HTML.

---

## When Triggered

When the user provides words, vocabulary lists, or reading text and requests English vocabulary cards:

1. **Extract & Normalize Words**:
   - Identify candidate words or idioms to learn.
   - Clean up word casing, check accurate IPA transcription (British or American standard).
   - Specify accurate part of speech / word class (`noun`, `verb`, `adjective`, `adverb`, `phrasal verb`, `idiom`, etc.).

2. **Formulate Rich Learning Content**:
   - **Definition**: Clear, learner-friendly English definition (e.g., Oxford/Cambridge style).
   - **Meanings in Vietnamese & Japanese**:
     - `meaning_vn`: Natural Vietnamese translation with common nuances.
     - `meaning_jp`: Japanese translation (kanji/kana), helpful for bilingual learners or cross-lingual recall.
   - **Contextual Examples**:
     - `example`: High-quality sentence using the word naturally in context (highlight target word with `**bold**` markdown).
     - `example_vn`: Vietnamese translation of the example sentence.
     - `example_jp`: Japanese translation of the example sentence.
   - **Collocations**: Typical word partnerships, prepositions, or frequent phrasing (e.g., `make a decision`, `deeply concerned about`).
   - **Image Prompt**: A concise, descriptive image generation prompt (in English) depicting the concrete scene or concept, suitable for text-to-image generation (or `"N/A"` if purely abstract).

3. **Output Strict Valid JSON**:
   - Output must be a top-level JSON array `[...]`.
   - All 11 fields are required for each card.

---

## Schema & Output Format

Each object in the JSON array MUST contain all 11 fields:

```typescript
interface VocabItem {
  word: string; // The vocabulary word or expression (e.g. "meticulous")
  ipa: string; // International Phonetic Alphabet (e.g. "/mɪˈtɪkjələs/")
  word_class: string; // Part of speech (e.g. "adjective", "verb", "noun")
  definition: string; // Clear English definition
  meaning_vn: string; // Vietnamese translation / meaning
  meaning_jp: string; // Japanese translation / meaning
  example: string; // Example sentence in English (markdown supported)
  example_vn: string; // Vietnamese translation of the example
  example_jp: string; // Japanese translation of the example
  collocations: string; // Common collocations, idioms, or patterns
  image_prompt: string; // Visual prompt for image generation, or "N/A"
}
```

### JSON Example

```json
[
  {
    "word": "meticulous",
    "ipa": "/mɪˈtɪk.jə.ləs/",
    "word_class": "adjective",
    "definition": "Showing great attention to detail; very careful and precise.",
    "meaning_vn": "Tỉ mỉ, cẩn thận, kỹ lưỡng đến từng chi tiết nhỏ.",
    "meaning_jp": "細心の、綿密な、非常に丁寧な",
    "example": "He was **meticulous** about keeping his financial records organized.",
    "example_vn": "Anh ấy rất tỉ mỉ trong việc sắp xếp ngăn nắp các hồ sơ tài chính của mình.",
    "example_jp": "彼は財務記録を整理することに非常に細心であった。",
    "collocations": "meticulous research, meticulous attention to detail, meticulously planned",
    "image_prompt": "A focused watchmaker using a magnifying eyepiece to adjust miniature gear parts on a wooden desk, high detail, warm lighting"
  },
  {
    "word": "resilience",
    "ipa": "/rɪˈzɪl.jəns/",
    "word_class": "noun",
    "definition": "The capacity to recover quickly from difficulties; toughness.",
    "meaning_vn": "Khả năng phục hồi, sự kiên cường vượt qua khó khăn, nghịch cảnh.",
    "meaning_jp": "回復力、立ち直る力、レジリエンス",
    "example": "The community showed incredible **resilience** in rebuilding their homes after the hurricane.",
    "example_vn": "Cộng đồng đã thể hiện sự kiên cường đáng kinh ngạc khi xây dựng lại nhà cửa sau cơn bão.",
    "example_jp": "地域社会はハリケーンの後、家を再建するにあたり信じられないほどの回復力を示した。",
    "collocations": "show/demonstrate resilience, emotional resilience, build resilience",
    "image_prompt": "A small green sprout growing determinedly through a crack in dry concrete pavement, symbolic, sunlight"
  }
]
```

---

## Quality Checklist

- [ ] Top-level element is a JSON array `[...]`.
- [ ] No missing fields (even if abstract, provide a meaningful `image_prompt` or `"N/A"`).
- [ ] IPA transcription uses accurate IPA characters (e.g. `/ə/`, `/ɪ/`, `/æ/`, `/θ/`).
- [ ] The target word inside `example` is wrapped in `**bold**` markdown.
- [ ] Collocations are separated by commas for clear reading.

---

## Compilation Command

To compile into an Anki `.apkg` deck:

```bash
# Basic compilation
anki-tool --type vocab <output.json>

# With custom deck name
anki-tool --type vocab --deck-name "English::Advanced Vocab" <output.json>
```
