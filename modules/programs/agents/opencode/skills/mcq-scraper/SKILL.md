---
name: mcq-scraper
description: >
  Scrape multiple-choice questions (MCQs) from any online test/exam website and output structured JSON for Anki.
  ALWAYS use this skill when a user provides a URL to a test/exam page and asks to download, scrape, save,
  or extract questions. Handles SSR (fetch+cheerio), SPA (Playwright), click-through (click each question to reveal),
  and API-based sites. Vietnamese phrases: "scrape đề thi", "lấy câu hỏi trắc nghiệm", "download trắc nghiệm",
  "tải bộ đề", "lấy đáp án", or any URL + "giúp tôi". Do NOT assume a specific domain — analyze each site fresh.
  Covers question extraction, answer detection, and LLM-generated explanations for Anki flashcard import.
---

# MCQ Scraper

## How This Skill Works

Your job: given a URL to an online test/exam page, extract all multiple-choice questions and output a JSON array.

The core idea is **probe-first**: start with the simplest approach (SSR fetch), escalate to Playwright for JS-rendered or click-through sites, inspect network traffic for API-based sites. Adapt to what you find rather than guessing.

**No adapter scripts.** You work directly — fetch, parse, click, extract, save. No templates, no generated code.

---

## Dependencies

**Runtime:** Node.js (available globally).  
**Key tools used inline:**

- `fetch` + `cheerio` for SSR HTML parsing (import inline)
- Playwright browser tools (`playwright_browser_*`) for SPA/click-through sites
- Your own LLM capability for generating explanations

When you need cheerio inline:

```ts
import * as cheerio from "cheerio";
const $ = cheerio.load(html);
```

---

## Step 0: Quick Assessment

Before probing, determine the site type from visual inspection:

- [ ] **SSR (server-rendered):** URL loads full HTML with questions visible. Use `fetch` + cheerio.
- [ ] **SPA (JS-rendered):** Page shows loading spinner, then questions appear. Use Playwright.
- [ ] **Click-through:** Shows a list of question numbers /_ 1, 2, 3... _/, click each to reveal. Use Playwright + click loop.
- [ ] **Paginated:** Questions split across multiple pages. Need to iterate pages.
- [ ] **API-based:** Network tab reveals JSON/XHR endpoints returning question data.

If unsure, start with SSR probe and escalate.

---

## Step 1: Probe the Site

### 1A. Try SSR (fetch + cheerio)

- [ ] Fetch the page with realistic headers:
  ```ts
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    },
  });
  const html = await res.text();
  ```
- [ ] Check if HTML contains actual question content:
  - Look for `.question`, `li.answer`, `.option`, `input[type="radio"]`, `.exam-content`
  - Look for any container with multiple-choice structure
- [ ] If 403/503 or Cloudflare challenge → skip to 1D (anti-bot)
- [ ] If HTML is almost empty / `<div id="root">` with no content → this is SPA. Go to 1B.
- [ ] If HTML has question navigation items but empty content → click-through. Go to 1C.

### 1B. Try SPA (Playwright)

- [ ] Use `playwright_browser_navigate` to load the URL
- [ ] Use `playwright_browser_snapshot` to see the rendered page
- [ ] Use `playwright_browser_network_requests` (static: false) to check for API calls fetching question data
- [ ] If snapshot shows questions rendered in DOM → extract with `playwright_browser_evaluate`
- [ ] If snapshot shows question numbers but empty content per question → go to 1C (click-through)
- [ ] If Playwright also hits anti-bot → go to 1D

### 1C. Click-Through Detection (Playwright)

Signs: page shows a list of numbers (1, 2, 3...) or items, and clicking each reveals that question.

- [ ] Snapshot the page to identify the question navigation list:
  ```ts
  // Look for: .question-numbers a, .question-list li, .nav-questions a, ul.pagination li a
  // Each item typically has: question number text, href or onClick
  ```
- [ ] Identify a stable selector for question items (e.g., `.question-nav a`, `ul.question-list li`)
- [ ] Click the first item, wait briefly (1-2s), then snapshot to see if content appeared
- [ ] If content loads → this is a click-through site. Proceed to Step 3C.
- [ ] If no content after click → try looking for hidden API in network tab (go to 1E)

### 1D. Anti-Bot (Cloudflare / Datadome)

- [ ] **Playwright stealth approach:**
  ```
  Navigate → wait 5s → snapshot
  ```
- [ ] If challenge resolves, proceed normally
- [ ] Try custom headers via fetch:
  ```ts
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
      Referer: new URL(url).origin + "/",
    },
  });
  ```
- [ ] **Fallback:** If all methods fail, tell the user the site has anti-bot protection that couldn't be bypassed.

### 1E. Check for Hidden API

- [ ] Use Playwright network monitoring:
  ```
  playwright_browser_network_requests(static: false)
  ```
- [ ] Look for XHR/fetch requests returning JSON with question data
- [ ] Common API patterns: `/api/exam/{id}/questions`, `/wp-json/...`, `/get-question`, GraphQL
- [ ] If found, use fetch directly on the API (much faster)

### ✓ Verification Checkpoint A

After probing, confirm before proceeding:

- [ ] Successfully accessed site content?
- [ ] Identified site type: SSR / SPA / Click-through / API?
- [ ] Can see at least one question with its options?

If blocked or can't determine structure → **STOP and report to user**.

---

## Step 2: Understand Question Structure

### 2A. Identify Question Elements

Study the DOM to find patterns. Common structures:

**SSR structure:**

```html
<div class="question-item" data-id="1">
  <p class="question-text">Nguyên hàm của sin(x) là?</p>
  <ul class="options">
    <li class="option correct">A. cos(x)</li>
    <!-- correct class -->
    <li class="option">B. -cos(x)</li>
    <li class="option">C. sin(x)</li>
    <li class="option">D. -sin(x)</li>
  </ul>
  <div class="explanation">Giải thích: ...</div>
</div>
```

**Click-through structure (after click):**

```html
<div class="question-content active">
  <h3>Câu 1: Kết quả của 2+2?</h3>
  <div class="answers">
    <label>A: 3</label>
    <label class="selected">B: 4</label>
    <!-- selected/correct -->
    <label>C: 5</label>
    <label>D: 22</label>
  </div>
</div>
```

For each question, identify:

- [ ] **Question text selector:** `.question-text`, `h3`, `.question-content p`, `.exam-question`, `.q-text`
- [ ] **Options container:** `.options`, `.answers`, `ul.answer-list`, `.choice-list`
- [ ] **Single option selector:** `.option`, `li`, `.answer-item`, `label.choice`
- [ ] **Correct answer marker:** class `.correct`, `.right`, `.selected`, `.answered-correct`, attribute `data-correct`, radio `checked`, or text marker (✓, ✅, (Đ))
- [ ] **Explanation:** `.explanation`, `.solution`, `.comment`, `.feedback`, `.gthich`, blockquote after answer
- [ ] **Question nav (click-through):** `.question-numbers`, `.nav-list`, `ul.pagination`

### 2B. Common Answer Markers

Vietnamese test sites commonly mark correct answers as:

- Class: `correct`, `true`, `dung`, `result-correct`, `answered-correct`
- Visual: Bold text, green text, checkmark icon (✓, ✅)
- After submission: `.result-item .is-correct`, `.answer-result .correct`
- Hidden: `<input type="hidden" value="A">`, `data-answer="A"`
- Text: "Đáp án: A", "ĐA: B", "Correct: C", "Chọn D"

### 2C. Common Question Navigation (Click-Through Sites)

Many Vietnamese test sites use this pattern:

- Number buttons at top/side: `1`, `2`, `3`, ... `40`
- Clicking a number loads/reveals that question
- Styling: `.answered` (đã trả lời), `.marked` (đã đánh dấu), `.current` (đang chọn)

---

## Step 3: Extract Questions

### 3A. SSR Extraction (fetch + cheerio)

Once you've identified selectors, extract:

```ts
import * as cheerio from "cheerio";

// After fetching HTML
const $ = cheerio.load(html);
const questions: Question[] = [];

$(".question-item, .exam-question, .quiz-question, .question-block").each(
  (_, el) => {
    const $q = $(el);
    const question = $q
      .find(".question-text, h3, .q-text, p:first")
      .text()
      .trim();
    const options: Record<string, string> = {};
    const answer = detectCorrectAnswer($q);
    const explanation = $q
      .find(".explanation, .solution, .feedback, .gthich")
      .text()
      .trim();

    $q.find(".option, li.answer-item, label.choice, .answer-option").each(
      (i, opt) => {
        const letter = String.fromCharCode(97 + i); // a, b, c, d...
        const text = $(opt)
          .text()
          .trim()
          .replace(/^[A-D][.\)]\s*/, "");
        options[letter] = text;
      },
    );

    questions.push({ question, options, answer, explanation });
  },
);
```

- [ ] Parse each question container into question text + options + answer + explanation
- [ ] If options use label text (A., B., etc.), extract letter from label
- [ ] If no label, assign a, b, c, d by order

### 3B. SPA Extraction (Playwright Evaluate)

- [ ] Use `playwright_browser_snapshot` to see the rendered DOM
- [ ] Use `playwright_browser_evaluate` to extract data via JS:
  ```ts
  playwright_browser_evaluate({
    function: `() => {
      const items = document.querySelectorAll('.question-item');
      return Array.from(items).map((el, idx) => {
        const question = el.querySelector('.question-text')?.textContent?.trim() || '';
        const options = {};
        const optEls = el.querySelectorAll('.option, .answer-item, li.choice');
        optEls.forEach((opt, i) => {
          const letter = String.fromCharCode(97 + i);
          const text = opt.textContent?.trim().replace(/^[A-D][.\)]\s*/, '') || '';
          options[letter] = text;
        });
        const correctEl = el.querySelector('.correct, .true, .dung, .selected, [data-correct]');
        const answer = correctEl ? String.fromCharCode(97 + Array.from(optEls).indexOf(correctEl)) : '';
        const explanation = el.querySelector('.explanation, .feedback, .solution')?.textContent?.trim() || '';
        return { question, options, answer, explanation };
      });
    }`,
  });
  ```

### 3C. Click-Through Extraction

For sites where each question appears only after clicking a navigation item:

- [ ] **Get question count:**

  ```
  playwright_browser_snapshot
  ```

  Identify all question navigation items (numbers 1-N).

- [ ] **Extract question IDs or selectors:**

  ```
  playwright_browser_evaluate({
    function: `() => Array.from(document.querySelectorAll('.question-nav a, .question-number, ul.pagination li'))
      .map(el => el.textContent.trim())
      .filter(t => t && !isNaN(parseInt(t)))`
  })
  ```

- [ ] **Collect all questions by clicking each:**

  ```
  For each question index i (0 to N-1):
    1. Click the nav item: playwright_browser_click(target: `.question-nav a:nth-child(${i+1})`)
    2. Wait 1-2s for content load: playwright_browser_wait_for(time: 1.5)
    3. Extract current question: playwright_browser_evaluate(function: `() => {
      // Find the visible/active question element
      const el = document.querySelector('.question-content.active, .question-item:not(.hidden), [style*="display: block"]');
      if (!el) return null;
      // Extract question, options, answer, explanation
      ...
    }`)
    4. Append to questions array
    5. Be mindful of time — batch if many questions
  ```

- [ ] **Alternative approach for sites that do NOT hide questions but just highlight:**
  - Snapshot once after all questions loaded
  - Extract all question elements in one `evaluate` call

### 3D. API Extraction

If you found an API endpoint:

- [ ] Fetch the API directly:
  ```ts
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": "...", Accept: "application/json" },
  });
  const data = await res.json();
  ```
- [ ] Map the API's structure to your output format
- [ ] If API requires auth tokens, check if they're in the page source or cookies

### 3E. Pagination

If questions span multiple pages:

- [ ] **SSR pagination:** Find "next page" link/button URL pattern. Iterate.
- [ ] **SPA pagination:** Click "next" button, wait for content, extract, repeat.
- [ ] **API pagination:** Check for `page`, `offset`, `limit` params. Iterate.
- [ ] Detect pagination by: looking for "Trang 1/10", "Page 1 of 5", `.pagination`, `.page-numbers`

### 3F. Special: Post-Submission Extraction

Some sites show answers only after submitting (clicking "Xem kết quả", "Nộp bài", "Hoàn thành"):

- [ ] Before clicking submit: note all questions and selected options
- [ ] Click submit button: `playwright_browser_click(target: "#submit-btn, .submit-exam, button:has-text('Nộp bài')")`
- [ ] Wait for result page to load
- [ ] Extract correct answers from result display (usually highlighted in green/red)
- [ ] If original question text is no longer visible on result page, combine pre-submit questions + post-submit correct answers

### ✓ Verification Checkpoint B

After extraction, verify:

- [ ] Correct number of questions extracted (match page count)?
- [ ] Each question has non-empty `question` text
- [ ] Each question has 2-6 options
- [ ] `answer` field is populated for at least some questions

If extraction failed (empty questions, 0 results) → **STOP and debug** before proceeding.

---

## Step 4: Detect & Normalize Answers

For each extracted question, determine the correct answer:

### 4A. Auto-Detect from Markers

Check for these markers (in priority order):

1. **Class-based:** `.correct`, `.true`, `.dung`, `.right`, `.answered-correct`, `.selected`, `.is-correct`
2. **Attribute-based:** `data-correct="true"`, `data-answer="A"`, `checked="checked"` (radio/checkbox)
3. **Text-based:** Option text ends with `✓`, `✅`, `(Đ)`, `(*)`
4. **Styling-based:** Bold text among non-bold options
5. **Post-submit:** `.result-correct`, `.correct-answer`, green/red highlight on result page
6. **Inline text:** "Đáp án: A", "ĐA: B", "Correct answer: C", "Chọn D" — look for this pattern in the HTML near the question

### 4B. Multiple Answers

Some questions have multiple correct answers:

- [ ] Detect by: multiple elements with `.correct` class, or text "chọn nhiều đáp án", "multiple choice"
- [ ] Format: `"answer": ["a", "c"]` or `"answer": "a, c"`

### 4C. Unknown Answers

- [ ] If no answer can be determined: set `"answer": ""`
- [ ] Note in output summary how many questions have vs lack answers

### ✓ Verification Checkpoint C

- [ ] Questions with answers identified: X/Y
- [ ] No false positives (e.g., all options marked correct)

---

## Step 5: Generate Explanations

After extraction, for questions that lack an `explanation` field:

- [ ] Use your own LLM capability to generate concise explanations
- [ ] Prompt yourself with the question context:

  ```
  Based on the following multiple-choice question, generate a brief explanation
  in Vietnamese explaining why the correct answer is right:

  Question: {question}
  Options: {options}
  Correct: {answer}
  ```

- [ ] Keep explanations concise (1-3 sentences)
- [ ] For math/formula questions, include the step-by-step reasoning
- [ ] Mark generated explanations: add `"explanation_generated": true`

---

## Step 6: Output JSON

### 6A. Define Output Path

```
mcq-scraper/{domain}/
  {source-slug}.json
```

Derive path:

- `domain` = hostname prefix (e.g., `tracnghiem` from `https://tracnghiem.vn/...`)
- `sourceSlug` = slugified exam title or filename from URL

Create directory:

```bash
mkdir -p mcq-scraper/{domain}
```

### 6B. JSON Format

```json
{
  "source": {
    "url": "https://...",
    "title": "Exam title or filename",
    "totalQuestions": 50
  },
  "questions": [
    {
      "question": "Câu hỏi (hỗ trợ markdown, code block, ảnh)",
      "options": {
        "a": "Đáp án A",
        "b": "Đáp án B",
        "c": "Đáp án C",
        "d": "Đáp án D"
      },
      "answer": "a",
      "explanation": "Giải thích (markdown)"
    }
  ]
}
```

**For Anki import:** The JSON array can be imported via AnkiConnect or genanki.

### 6C. Markdown Cleanup Rules

When extracting text, apply these normalizations:

- [ ] **Bold:** `**text**` from `<strong>`, `<b>`
- [ ] **Italic:** `*text*` from `<em>`, `<i>`
- [ ] **Inline code:** `` `code` `` from `<code>`, `<tt>`
- [ ] **Code blocks:** ` ```language ``` ` from `<pre><code>`
- [ ] **Images:** `<img src="file.png">` — keep HTML tags as-is
- [ ] **Cloze deletions:** If question fill-in-the-blank, use `{{c1::keyword::hint}}` for Anki cloze format
- [ ] **Line breaks:** Convert `<br>` to `\n`, strip excess whitespace
- [ ] **Math:** `<math>` or `\(...\)` inline LaTeX → format as `$...$` or `\(...\)` depending on source

### 6D. Save File

```ts
import { mkdir, writeFile } from "node:fs/promises";

const json = JSON.stringify(output, null, 2);
await writeFile(outputPath, json, "utf8");
console.log(`Saved ${output.questions.length} questions to ${outputPath}`);
```

### ✓ Verification Checkpoint D

- [ ] JSON file saved successfully
- [ ] JSON is valid (parseable)
- [ ] Question count matches expectation
- [ ] Spot-check a few entries — question text + options + answer are correct

---

## Step 7: Final Verification

Before declaring done:

- [ ] **Count:** Question count matches what the site displayed
- [ ] **Content:** Random question has correct text (no HTML artifacts)
- [ ] **Options:** Each question has 2-6 options
- [ ] **Answers:** At least some answers are populated (unless site hides them)
- [ ] **Explanations:** Present for most questions (scraped or generated)
- [ ] **JSON valid:** `python -c "import json; json.load(open('path/to/file.json'))"` or manual check
- [ ] **Images:** `<img>` tags preserved if present on source

If any check fails → **fix the issue** (re-extract or adjust parsing) before declaring complete.

---

## Common Vietnamese Test Site Patterns

### tracnghiem.vn / onthi.vn / thi247.com

- SSR: questions in HTML, `.quest-item`, `.quest-content`
- Options: `.option-item` or `li`
- Correct: `class="correct"` or `data-correct`
- URL pattern: `/de-thi/{slug}.html` or `/quiz/{id}`

### vndoc.com / doctailieu.com

- SSR: `.question-content`, `.qa-wrapper`
- Options: `.answer-item`, `.option-item`
- Correct: `class="true"`, `data-value` attribute
- Often has explanation: `.comment`, `.gthich`

### sites with paginated results

- URL pattern: `/exam/{id}?page={N}`
- Detect pagination via `.pagination a`
- Iterate pages until last

### SPA sites (React/Vue based)

- Empty HTML shell, content rendered by JS
- Use Playwright snapshot to view content
- Check `window.__NUXT__`, `window.__INITIAL_STATE__`, or React dev tools for embedded question data
- Often the data is in a `<script>` tag as JSON

### Sites requiring submission

- Flow: answer questions → click "Nộp bài" / "Xem kết quả" → review correct/incorrect
- Strategy: extract questions before submit (for text) + after submit (for correct answers)
- Need to handle: detecting submit button, waiting for result page, extracting result data

---

## When Things Go Wrong

- **No questions found:** The selectors are wrong. Snapshot the page and inspect for actual question structure
- **0 questions extracted (SSR):** Site might be SPA. Switch to Playwright
- **Cannot click question numbers:** Selector might be dynamic. Use `page.evaluate` to click via JS: `document.querySelectorAll('.nav-item')[i].click()`
- **Answer not detected:** Site might hide answers until after submission. Check if there's a "Xem đáp án" button
- **API returns empty/cors error:** API might require auth token or referer header. Check page cookies
- **Site blocks after N requests:** Add delays between clicks, randomize timing
- **Questions have images:** Use `playwright_browser_evaluate` with `innerHTML` to capture `<img>` tags, don't strip them
- **Math formulas in LaTeX:** Preserve `\(...\)` and `\[...\]` patterns, don't strip
- **Turndown throws error:** Extract innerHTML directly rather than converting through markdown

## Design Principles

Think of each MCQ site as a puzzle with four key pieces:

1. **Where do questions live?** (container structure)
2. **What's the question text?** (extraction target)
3. **Where are the options and correct answer?** (option structure + markers)
4. **How do you access all questions?** (SSR/SPA/click/API)

The answers vary per site, but the approach is always the same: probe, analyze, adapt, execute.
