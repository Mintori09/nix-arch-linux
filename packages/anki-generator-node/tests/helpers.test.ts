import { test, describe } from "node:test";
import assert from "node:assert";
import {
  parseJsonInput,
  convertMarkdownToHtml,
  getParserForData,
  validateJsonStructure,
} from "../src/utils/helpers.js";
import { VocabParser } from "../src/parsers/vocab.js";
import { GrammarParser } from "../src/parsers/grammar.js";
import { MCQParser } from "../src/parsers/mcq.js";

describe("JSON Helpers", () => {
  test("parseJsonInput strips code blocks and parses array", () => {
    const raw = '```json\n[{"word": "test"}]\n```';
    const result = parseJsonInput(raw);
    assert.deepStrictEqual(result, [{ word: "test" }]);
  });

  test("parseJsonInput throws error on invalid json with line and column info", () => {
    const invalidJson = '[\n  {\n    "word": "hello",\n  }\n]';
    assert.throws(
      () => parseJsonInput(invalidJson),
      (err: any) => {
        return (
          err instanceof Error &&
          err.message.includes("JSON Syntax Error") &&
          err.message.includes("Line")
        );
      },
    );
  });

  test("validateJsonStructure throws friendly error on missing field with card index", () => {
    const invalidItem = [
      {
        question: "Sample Q",
        // missing options, answer, explanation
      },
    ];

    assert.throws(
      () => validateJsonStructure(invalidItem, "mcq"),
      (err: any) => {
        return (
          err instanceof Error &&
          err.message.includes("Card #1") &&
          err.message.includes('Missing required field(s): "options"')
        );
      },
    );
  });

  test("validateJsonStructure accepts valid mcq-shuffle payload", () => {
    const validMcqShuffleData = [
      {
        question: "What is TypeScript?",
        options: {
          a: "A programming language",
          b: "A style sheet",
          c: "A database",
          d: "An OS",
        },
        answer: "a",
        explanation:
          "TypeScript is a strongly typed programming language that builds on JavaScript.",
      },
    ];

    assert.doesNotThrow(() => validateJsonStructure(validMcqShuffleData, "mcq-shuffle"));
  });
});

describe("Markdown to HTML Converter", () => {
  test("converts block code fences", () => {
    const md = "Here is code:\n```python\ndef test():\n    return True\n```";
    const html = convertMarkdownToHtml(md);
    assert.ok(
      html.includes('<pre><code class="language-python">def test():\n    return True</code></pre>'),
    );
  });

  test("converts inline backticks", () => {
    const md = "Use `console.log` for logs.";
    const html = convertMarkdownToHtml(md);
    assert.strictEqual(html, "Use <code>console.log</code> for logs.");
  });

  test("converts bold markdown to strong tag", () => {
    const md = "This is **bold text**.";
    const html = convertMarkdownToHtml(md);
    assert.strictEqual(html, "This is <strong>bold text</strong>.");
  });

  test("converts italic, bold-italic, and strikethrough markdown", () => {
    const md = "*italic* và ***bold italic*** và ~~gạch ngang~~";
    const html = convertMarkdownToHtml(md);
    assert.strictEqual(
      html,
      "<em>italic</em> và <strong><em>bold italic</em></strong> và <del>gạch ngang</del>",
    );
  });

  test("converts newlines to br", () => {
    const md = "Line 1\nLine 2";
    const html = convertMarkdownToHtml(md);
    assert.strictEqual(html, "Line 1<br>Line 2");
  });
});

describe("Parser Detection", () => {
  test("detects vocab parser", () => {
    const parser = getParserForData([{ word: "test" }]);
    assert.ok(parser instanceof VocabParser);
  });

  test("detects grammar parser", () => {
    const parser = getParserForData([{ pattern: "test" }]);
    assert.ok(parser instanceof GrammarParser);
  });

  test("detects mcq parser", () => {
    const parser = getParserForData([{ question: "test" }]);
    assert.ok(parser instanceof MCQParser);
  });
});
