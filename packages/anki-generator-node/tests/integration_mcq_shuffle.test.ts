import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { MCQShuffleParser } from "../src/parsers/mcq-shuffle.js";
import { generateApkg } from "../src/core/generator.js";

const SAMPLE_MCQ = [
  {
    question: "Which of the following is a primary color in RGB?",
    options: {
      a: "Red",
      b: "Yellow",
      c: "Cyan",
      d: "Magenta",
    },
    answer: "a",
    explanation: "RGB stands for Red, Green, and Blue.",
  },
  {
    question: "Which of the following are prime numbers?",
    options: {
      a: "2",
      b: "3",
      c: "4",
      d: "5",
    },
    answer: "a, b, d",
    explanation: "2, 3, and 5 are prime numbers. 4 is composite (2x2).",
  },
];

test("Integration: MCQShuffleParser parses sample data and generateApkg exports valid .apkg", async () => {
  const outputApkg = path.join(process.cwd(), "tests/fixtures/test_mcq_shuffle.apkg");

  if (!fs.existsSync(path.dirname(outputApkg))) {
    fs.mkdirSync(path.dirname(outputApkg), { recursive: true });
  }

  // Ensure clean start
  if (fs.existsSync(outputApkg)) {
    fs.unlinkSync(outputApkg);
  }

  try {
    const parser = new MCQShuffleParser();
    const parsedResult = await parser.parse(JSON.stringify(SAMPLE_MCQ));

    assert.strictEqual(parsedResult.cards.length, 2);

    await generateApkg(
      {
        parsedResult,
        parser,
        deckName: "MCQ::Shuffle::IntegrationTest",
      },
      outputApkg,
    );

    assert.ok(fs.existsSync(outputApkg), "Generated APKG file should exist");
    const stats = fs.statSync(outputApkg);
    assert.ok(stats.size > 0, "Generated APKG file size should be greater than 0");
  } finally {
    // Cleanup
    if (fs.existsSync(outputApkg)) {
      fs.unlinkSync(outputApkg);
    }
  }
});
