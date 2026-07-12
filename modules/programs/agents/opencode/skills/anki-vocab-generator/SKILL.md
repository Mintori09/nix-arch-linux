---
name: anki-vocab-generator
description: >
  Generate structured Anki card data (JSON array) from any vocabulary word or
  phrase. ALWAYS use when user asks to create Anki flashcards, vocabulary cards,
  or needs structured word data with IPA, definitions, examples, and translations.
  Handles single words, idioms, phrasal verbs. Output JSON has 11 fields per card
  for genanki import. Vietnamese triggers: "tạo thẻ Anki", "tạo flashcard", "card
  từ vựng", "từ mới", "từ vựng". English triggers: "anki card", "flashcard",
  "vocab card", "make a card for", "anki deck".
---

# Anki Vocab Generator

## Overview

Your job: given a vocabulary word/phrase from the user, produce a **single JSON array** containing one or more card objects. If the word has multiple meanings (e.g., "run" as verb vs noun), create a separate object for each distinct sense.

**Output rule:** ONLY the JSON code block. No preamble, no postamble, no commentary. And save to json file in similiar directory.

---

## Input

The user provides a vocabulary word, phrase, idiom, or phrasal verb. Examples:

```text
ubiquitous
"cut corners"
"break the ice"
run (v)
turn down (phrasal verb)
```

If the user provides no context, infer the most common meaning. If they specify a context ("trong kinh doanh", "in finance"), use that context to select the correct sense.

---

## Output Format

A JSON array of objects. Each object has exactly these 11 keys:

| #   | Key            | Type   | Description                                                           |
| --- | -------------- | ------ | --------------------------------------------------------------------- |
| 1   | `word`         | string | The original vocabulary word/phrase                                   |
| 2   | `ipa`          | string | IPA transcription (General American preferred)                        |
| 3   | `word_class`   | string | Part of speech: `n`, `v`, `adj`, `adv`, `phrasal verb`, `idiom`, etc. |
| 4   | `definition`   | string | Concise English definition                                            |
| 5   | `meaning_vn`   | string | Vietnamese meaning matching the example context                       |
| 6   | `meaning_jp`   | string | Japanese meaning matching the example context                         |
| 7   | `example`      | string | Natural English example sentence                                      |
| 8   | `example_vn`   | string | Vietnamese translation of the example                                 |
| 9   | `example_jp`   | string | Japanese translation (with complete romaji in parentheses)            |
| 10  | `collocations` | string | 1-3 common collocations, synonyms, or related phrases                 |
| 11  | `image_prompt` | string | Scene description for image search, or `"N/A"` for abstract words     |

Output as a clean, valid JSON array:

```json
[
  {
    "word": "ubiquitous",
    "ipa": "/juːˈbɪk.wɪ.təs/",
    "word_class": "adj",
    "definition": "Present, appearing, or found everywhere.",
    "meaning_vn": "có mặt ở khắp nơi, phổ biến khắp nơi",
    "meaning_jp": "至る所にある、遍在する",
    "example": "Smartphones have become ubiquitous in modern society.",
    "example_vn": "Điện thoại thông minh đã trở nên phổ biến khắp nơi trong xã hội hiện đại.",
    "example_jp": "スマートフォンは現代社会で至る所で見られるようになった。 (sumātofon wa gendai shakai de aru tokoro de mirareru yō ni natta.)",
    "collocations": "ubiquitous presence, ubiquitous computing, seemingly ubiquitous",
    "image_prompt": "A busy city street where everyone is holding a smartphone, with icons floating in the air showing connectivity everywhere"
  }
]
```

---

## Field-by-Field Guide

### word

The exact input from the user, normalized. If the user provided part of speech in parentheses (e.g., "run (v)"), strip the annotation but keep the base form: `"run"`.

### ipa

- Use **General American** pronunciation (not British RP) as default
- Format: `/ˈɛk.zɑː.mɪn/`
- Wrap in forward slashes
- Use primary stress `ˈ` and secondary stress `ˌ` where needed
- If the user specifies British preference, use RP instead
- If unsure, prefer American

### word_class

Use standard abbreviations:

- `n` — noun
- `v` — verb
- `adj` — adjective
- `adv` — adverb
- `pron` — pronoun
- `prep` — preposition
- `conj` — conjunction
- `interj` — interjection
- `phrasal verb` — phrasal verb
- `idiom` — idiom
- `collocation` — fixed expression

### definition

- Write in plain English, no nested clauses
- Start with a lowercase letter (unless proper noun)
- No period at the end if it's a phrase fragment
- Be concise: 5-15 words ideally

### meaning_vn / meaning_jp

- Must match the context of the **example sentence**
- If the word has multiple meanings in general, choose the one demonstrated in the example
- Use natural, idiomatic translations, not literal word-for-word
- Separate multiple glosses with commas

### example

- Write a **natural, contemporary** sentence
- Show the word used in a context that makes its meaning obvious
- Avoid contrived or overly simplistic sentences like "This is a book"
- Prefer sentences about technology, business, daily life, science, or culture
- Length: 8-20 words

### example_vn / example_jp

- Natural translations, not literal
- For Japanese: **always append the complete romaji in parentheses**
- Romaji follows Modified Hepburn system
- Romaji goes **after** the closing parenthesis of the example, like: `日本語の文。 (nihongo no bun.)`
- Capitalize proper nouns in romaji the same way as in the original
- The romaji must cover the **entire Japanese sentence**, including particles, punctuation equivalents

### collocations

- 1-3 items separated by commas
- Prefer **adjective+noun**, **verb+noun**, or **adverb+verb** patterns
- Can include synonyms if they're more common/useful
- Example: `"heavy rain, torrential downpour, rain cats and dogs"`

### image_prompt

A brief English description that could be used to search for or generate an image:

- **Concrete words** (tree, run, computer): describe a simple scene showing the concept
  ```
  "A person jogging in a park on a sunny morning"
  ```
- **Abstract words** (freedom, ubiquitous, exacerbate): use `"N/A"`

Exception: if the abstract word can be represented metaphorically in a recognizable way, write a prompt:

- "freedom" → `"A bird flying out of an open cage toward a bright sky"`
- "loneliness" → `"A single person sitting alone on a bench in a large empty park"`

When in doubt, `"N/A"`.

---

## Workflow

### Step 1: Analyze the Input

- [ ] Identify the word/phrase and its likely part of speech
- [ ] If ambiguous, check if user provided context
- [ ] Decide how many senses to create (1 object per sense)
- [ ] If multiple senses, keep them in a single JSON array

### Step 2: Research the Data

Use your available tools and knowledge:

- [ ] Determine IPA with primary/secondary stress (General American)
- [ ] Determine word class
- [ ] Formulate a concise English definition
- [ ] Create a natural example sentence
- [ ] Translate to Vietnamese (natural, not literal)
- [ ] Translate to Japanese + generate complete romaji
- [ ] Identify 1-3 useful collocations/synonyms
- [ ] Decide on image prompt

If the word is obscure, technical, or domain-specific, you may use context7 MCP or web search to verify pronunciation and definition.

### Step 3: Validate

- [ ] All 11 fields present
- [ ] IPA wrapped in `/slashes/`
- [ ] Romaji present and complete in parentheses after Japanese example
- [ ] JSON is valid (no trailing commas, proper escaping)
- [ ] Vietnamese uses proper UTF-8 characters (no `\\uXXXX` escapes)
- [ ] Japanese uses proper UTF-8 kanji/kana (no `\\uXXXX` escapes)

### Step 4: Output

- [ ] Wrap in a single JSON code block: ` ```json ... ``` `
- [ ] No text before or after

---

## Edge Cases

### Multiple Meanings

If one word has distinct meanings, create multiple objects in the array:

```json
[
  {
    "word": "run",
    "ipa": "/rʌn/",
    "word_class": "v",
    "definition": "To move quickly on foot.",
    ...
    "collocations": "run fast, go for a run, run a marathon"
  },
  {
    "word": "run",
    "ipa": "/rʌn/",
    "word_class": "n",
    "definition": "A period of continuous operation or performance.",
    ...
    "collocations": "test run, a run of luck, in the long run"
  }
]
```

### Idioms

- `word_class` = `"idiom"`
- `definition` = the figurative meaning
- `example` should use it naturally in context

### Phrasal Verbs

- `word_class` = `"phrasal verb"`
- Include the particle in the `word` field: `"turn down"`
- `definition` explains the combined meaning

### Technical / Domain-Specific Terms

- Use the domain-appropriate definition
- Example should reflect the domain
- `image_prompt` → `"N/A"` unless a concrete visual representation exists

### Loanwords / Foreign Origins

- For words borrowed from other languages (e.g., "déjà vu", "à la carte"), preserve original diacritics in the `word` field
- Use an IPA that represents naturalized English pronunciation

---

## Romaji Formatting Rules

Modified Hepburn system:

| Hiragana              | Romaji               |
| --------------------- | -------------------- |
| し                    | shi                  |
| ち                    | chi                  |
| つ                    | tsu                  |
| ふ                    | fu                   |
| じ                    | ji                   |
| ぢ                    | ji                   |
| づ                    | zu                   |
| っ (double consonant) | tt, pp, ss, kk, etc. |
| ん + vowel            | n' (with apostrophe) |

- Long vowels: use macrons (ō, ū) or double vowels per your judgment — be **consistent**
- Particle は → `wa`, へ → `e`, を → `o`
- Capitalize the first word and proper nouns
- Add spaces between words
- Punctuation in romaji: keep `.`, `,`, `?`, `!`
- Full romaji **inside parentheses**, after the Japanese sentence, without its own period if the sentence ends with `。`:

```
私は毎日コーヒーを飲みます。 (watashi wa mainichi kōhī o nomimasu.)
```

---

## Design Principles

1. **Accuracy over speed** — IPA, definitions, and translations should be correct. Better to take extra care than to produce sloppy data.
2. **Natural language** — Example sentences and translations should sound like a native speaker wrote them.
3. **Consistency** — Within a single session, maintain consistent style for IPA, romaji, and field formatting.
4. **Self-contained output** — The JSON array should require no further editing. The user pastes it into `data.json` and runs their script.
5. **Context matters** — If the user says "từ này dùng trong kinh doanh", adapt all fields to a business context.
