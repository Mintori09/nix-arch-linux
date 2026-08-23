---
name: doc-to-mcq
description: >-
  Convert any document (.txt, .md, .docx, notes, lectures) into JSON multiple-choice question (MCQ) flashcard data for Anki.
  Use this skill whenever the user provides study material or asks to generate multiple-choice questions / trắc nghiệm.
  Supports both standard MCQ (--type mcq) and randomized/shuffled MCQ (--type mcq-shuffle).
  Triggers on Vietnamese phrases like "tạo trắc nghiệm từ tài liệu", "làm trắc nghiệm anki", "tạo câu hỏi mcq", "chuyển file thành trắc nghiệm", "tạo mcq shuffle".
---

# Doc to MCQ Flashcard

Convert study materials, lecture notes, textbook excerpts, or documents into a structured JSON array of Multiple-Choice Questions (MCQs) ready for use with `--type mcq` or `--type mcq-shuffle` in the `anki-generator-node` project.

## When triggered

When the user provides a document or text and asks for multiple-choice questions:
1. **Read & Analyze** the source content to identify key concepts, definitions, rules, facts, or problem-solving patterns.
2. **Formulate High-Quality Questions**:
   - Clear and unambiguous question stem.
   - 3 to 5 options with realistic and plausible distractors (incorrect choices).
   - Specify the answer key (single letter e.g., `"a"`, `"b"`, or multiple comma-separated keys e.g., `"a, c"`).
   - **Thorough Explanations (BẮT BUỘC GIẢI THÍCH CHI TIẾT TỪNG PHƯƠNG ÁN)**:
     - Phải phân tích rõ ràng: **Vì sao đáp án được chọn lại đúng** và **vì sao từng phương án còn lại lại sai / không được chọn**.
     - Trình bày dạng danh sách gạch đầu dòng rõ ràng từng phương án (dùng markdown in đậm `**` hoặc HTML) để người học hiểu sâu bản chất kiến thức.
3. **Output Valid JSON**: Output a JSON array strictly conforming to the schema below.
4. **Provide Build Command**: Recommend compiling with `--type mcq-shuffle` (for randomizing option order on each review) or `--type mcq`.

## Schema & Output Format

The output MUST be a JSON array of objects with 4 fields: `question`, `options`, `answer`, `explanation`.

### Single Choice Example with Detailed Option Breakdown

```json
[
  {
    "question": "Trong JavaScript, kiểu dữ liệu nào sau đây là kiểu nguyên thủy (primitive data type)?",
    "options": {
      "a": "Array",
      "b": "Symbol",
      "c": "Object",
      "d": "Function"
    },
    "answer": "b",
    "explanation": "• **Đúng (b) Symbol**: Là 1 trong 7 kiểu dữ liệu nguyên thủy (Primitive Types) trong JavaScript (cùng với number, string, boolean, null, undefined, bigint). Các kiểu nguyên thủy bất biến (immutable) và được truyền theo giá trị.\n• **Sai (a) Array**: Không phải kiểu nguyên thủy, mà là một dạng đối tượng đặc biệt (object) kế thừa từ `Array.prototype`.\n• **Sai (c) Object**: Là kiểu dữ liệu phức hợp/tham chiếu (Reference Type), lưu trữ tập hợp các cặp key-value.\n• **Sai (d) Function**: Cũng là một đối tượng (Function Object/Callable Object), không phải kiểu nguyên thủy."
  }
]
```

### Multiple-Choice Example with Multiple Correct Answers

For questions with multiple correct choices:
- Set `answer` to comma-separated keys (e.g., `"a, c"` or `"a, b, d"`).
- The explanation must clearly explain each correct option as well as why the incorrect options are excluded.

```json
[
  {
    "question": "Những số nào sau đây là số nguyên tố?",
    "options": {
      "a": "2",
      "b": "3",
      "c": "4",
      "d": "5"
    },
    "answer": "a, b, d",
    "explanation": "• **Đúng (a) 2**: Là số nguyên tố chẵn duy nhất (chỉ chia hết cho 1 và chính nó).\n• **Đúng (b) 3**: Là số nguyên tố lẻ nhỏ nhất (chỉ có 2 ước là 1 và 3).\n• **Sai (c) 4**: Là hợp số (composite number) vì ngoài 1 và 4 nó còn chia hết cho 2 (2 x 2 = 4).\n• **Đúng (d) 5**: Là số nguyên tố (chỉ có 2 ước là 1 và 5)."
  }
]
```

## Compilation Command

To compile into an Anki `.apkg` file:

```bash
# Recommended: Shuffle options on every review to avoid memorizing by position
node src/index.js --type mcq-shuffle <output.json>

# Standard: Fixed option order as written in the JSON
node src/index.js --type mcq <output.json>
```
