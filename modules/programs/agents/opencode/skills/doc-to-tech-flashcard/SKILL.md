---
name: doc-to-tech-flashcard
description: >-
  Convert technical documentation, programming guides, code snippets, and architecture notes into atomic, high-yield Anki flashcards matching BasicItem format ({ front, back }) for anki-generator-node.
  Follows Dr. Piotr Wozniak's 20 Rules and Andy Matuschak's mental model guidelines for coding (Behavior prediction, Type inference, Syntax/Keyword cloze, Gotchas & Edge cases).
  Use whenever the user wants to create flashcards from code, programming docs, framework guides, DevOps/Docker/Linux notes, or technical tutorials.
  Triggers (VN): "tạo flashcard lập trình", "chuyển doc code thành flashcard", "tạo anki code", "flashcard kỹ thuật", "flashcard tech", "tạo thẻ lập trình", "tạo thẻ code".
  Triggers (EN): "tech to anki", "code flashcards", "programming anki", "doc to code flashcard", "convert tech doc to flashcards".
---

# Doc to Tech Flashcard (Code Craftsman)

Convert programming notes, technical documentation, and code guides into high-yield, atomic `{ front, back }` flashcard JSON objects for `anki-tool --type basic`.

## Core Philosophy (Combating Review Fatigue & Leeches)

Standard QA flashcards fail for programming because they encourage passive memorization of long text blocks or memorizing lines of code by rote.
This skill strictly enforces **3 Active Recall Mental Models**:

1. **Behavior & Type Prediction (Dự đoán hành vi & Kiểu dữ liệu):**
   - Provide a short, realistic code snippet (under 5 lines).
   - Prompt the user to predict the return type, the narrowed type, or the console output.
2. **Syntax, Keyword & Operator Precision:**
   - Test essential keywords, utility types, or operators (e.g., `keyof`, `typeof`, `as const`, `infer`, `readonly`, `Partial<T>`).
   - Use clear formatting (`<code>...</code>` or `<pre><code>...</code></pre>`).
3. **Gotchas, Edge Cases & Compiler Rules (Bẫy cú pháp & Lý do lỗi):**
   - Present a scenario where code fails or produces an unexpected result.
   - Front asks *why* it fails or how to fix it; Back explains the precise underlying mechanism.

## Formatting Standards

- **Front:**
  - Start with a clear category tag, e.g., `<b>[TypeScript Generics]</b>` or `<b>[Docker Compose]</b>`.
  - Use HTML tags: `<b>`, `<code>`, `<pre><code class="language-typescript">...</code></pre>`.
  - Keep snippets minimal (under 5 lines).
- **Back:**
  - Lead with the direct, concise answer first (e.g., `<code>string | undefined</code>` or `<b>Hợp lệ</b>`).
  - Follow with a concise explanation (1-2 sentences) detailing the *underlying principle*.
  - Note any critical edge cases or exceptions.

## Output Format

Outputs a valid JSON array of `BasicItem` elements:

```json
[
  {
    "front": "<b>[Topic]</b> Concise prompt or code snippet?",
    "back": "Direct answer<br><br>Explanation and why."
  }
]
```
