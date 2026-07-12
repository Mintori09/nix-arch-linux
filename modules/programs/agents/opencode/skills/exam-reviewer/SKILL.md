---
name: exam-reviewer
description: Format test/exam results (especially English/TOEIC tests) in markdown, highlight incorrect questions, and generate a detailed weakness analysis and action plan at the end of the document. Trigger this skill whenever the user asks to format test results, check wrong answers, review test files, or write a summary of weaknesses for a test/exam. Vietnamese trigger phrases include: "format bài thi", "đánh dấu câu sai", "nhận xét bài thi", "review bài tập", "phân tích lỗi sai", "phân tích câu sai".
---

# Exam Reviewer & Formatter Skill

Use this skill to clean up, format, and analyze test/exam result documents in Markdown format, identifying mistakes and compiling a tailored learning feedback report.

## Workflow

### 1. Identify Mistakes and Structure
Scan the document to understand the question blocks (e.g., numbered headings or bold numbers like `**101**`).
Identify which questions were answered incorrectly. A question is incorrect if it has a flag such as `Đáp án đúng: [Letter]` under the options (which typically indicates a system-corrected answer), or if it contains user-submitted incorrect answers.

### 2. Format Each Question
Re-write each question block using the following clean, standard Markdown structure:

- **Heading**:
  - For correct questions: `### Câu [Số]  (Đúng)`
  - For incorrect questions: `### Câu [Số] ❌ *(Làm sai)*`
- **Question text**: Wrap in a blockquote: `> **Đề bài:** [Question Text]`
- **Options**: List choices using bullet points:
  ```markdown
  **Lựa chọn:**
  - A. [Option A]
  - B. [Option B]
  ```
- **Correct Answer / Warning callout**:
  - If correct: `**Đáp án đúng:** [Letter] “[Answer Text]”`
  - If incorrect: Use a GitHub warning block:
    ```markdown
    > [!WARNING]
    > Bạn đã làm sai câu này.
    > **Đáp án đúng:** [Letter] “[Answer Text]”
    ```
- **Translations (if present)**: List under `**Dịch nghĩa từ vựng / lựa chọn:**`. Deduplicate any redundant translations.
- **Analysis**: Place under `**Phân tích ngữ pháp & ngữ cảnh:**`. Keep explanations concise and highlight key grammar/vocabulary rules.
- **Sentence translation**: Place under `**Dịch nghĩa câu:** *[Translated Sentence]*`.
- **References**: Keep the original reference links (e.g. `*[Giải thích chi tiết đáp án](#...)*`) at the bottom of the question block.

### 3. Generate Weakness Review & Assessment
At the very end of the file, append a section titled `## 📊 BÀI ĐÁNH GIÁ & RÚT KINH NGHIỆM`. This section must contain:

1. **Thống kê kết quả (Statistics)**:
   - Total questions, correct count (with percentage), wrong count.
   - A list of links pointing directly to the incorrect questions (e.g., `[Câu 103](#cau-103)`).
2. **Phân tích điểm yếu & Lỗi sai thường gặp (Error Analysis)**:
   - Categorize the incorrect questions into logical groups (e.g., **Vocabulary/Word Choice** vs. **Grammar & Structure**).
   - For each group, list the specific question numbers and explain exactly what grammatical/vocab point caused the mistake.
   - Provide concrete tips (`💡 Lời khuyên`) for each category.
3. **Hành động khắc phục (Action Plan)**:
   - Actionable next steps (e.g., creating collocation lists, reviewing specific grammar books, or a calendar schedule to re-take the questions).
