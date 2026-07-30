---
name: doc-to-basic-flashcard
description: >-
  Convert any document (.txt, .md, .docx) into JSON flashcard data matching the BasicItem format (front/back) for Anki import.
  Use this skill whenever the user provides a document or says they want to make flashcards from text, notes, a file, or study material.
  Also triggers on Vietnamese phrases like "tạo flashcard từ tài liệu", "chuyển file thành thẻ", "làm thẻ từ văn bản", "tạo json từ file".
  The skill reads the document, intelligently determines front/back pairs based on content structure and context, and outputs valid JSON.
---

# Doc to Basic Flashcard

Convert any document into a JSON array of `{ front, back }` objects ready for use with `--type basic` in the anki-generator-node project.

## When triggered

The user gives you a document (by path or content) and asks you to create flashcards from it. You should:

1. **Read the document** — use the Read tool to load the file, or accept pasted content
2. **Analyze structure** — determine how to split into front/back pairs based on the document's actual content and the user's stated goal
3. **Generate JSON** — output a valid JSON array of BasicItem objects
4. **Save if requested** — write to a `.json` file if the user specifies a path; otherwise print to stdout

## How to split front/back

Be intelligent about this — every document is different. Some examples of how to decide:

- **Section headings → Front, content → Back**: If the doc has structured sections (##, ###), heading text becomes `front`, key explanations become `back`
- **Term → Front, definition → Back**: If the doc lists terms with explanations, each term pair becomes one card
- **Rule → Front, example/details → Back**: Grammar rules, patterns, or formulas go on front; usage notes, examples, and explanations go on back
- **Question → Front, answer → Back**: If the doc has Q&A format

**General principles:**

- Keep `front` concise — a concept name, term, or question (what the user needs to recall)
- Keep `back` informative but focused — the answer, definition, or explanation (what the user needs to remember)
- Create separate cards for distinct concepts — don't cram multiple ideas into one card
- Use the user's stated learning goal to guide what goes where (e.g., "học phân biệt loại từ dựa vào đuôi" → front should show the suffix, back should show the word type and meaning)

## Output format

The output MUST be a JSON array. Each element is:

```json
{
  "front": "What goes on the front of the card",
  "back": "What goes on the back of the card"
}
```

This matches the `BasicItem` interface used by the project's `--type basic` flag. The JSON file can then be compiled with:

```
node src/index.js --type basic <output.json>
```

### Quality guidelines

- **Front must be self-contained**: The user should be able to read the front and know what they're being tested on
- **Back should have enough context**: Include examples, hints, or mnemonics that help recall
- **Strict valid JSON**: Use double quotes, no trailing commas, escape special characters
- **No markdown fences inside JSON values**: Use HTML or plain text
- **If there are many cards** (>20), group related concepts naturally but keep each card focused

## If the user provides a specific format

Sometimes the user will give you a file with a clear delimiter format (front|back per line, or tab-separated). In that case, follow their explicit format instead of analyzing context. Always respect explicit user instructions over the general approach above.
