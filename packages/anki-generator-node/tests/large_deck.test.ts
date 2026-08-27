import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { generateApkg, type InputDeckItem } from "../src/core/generator.js";
import { MCQShuffleParser } from "../src/parsers/mcq-shuffle.js";

describe("Large deck APKG export (Memory & Statement leak check)", () => {
  test("successfully generates .apkg for 2000 cards without running out of memory", async () => {
    const parser = new MCQShuffleParser();
    const count = 2000;
    const cards = [];
    for (let i = 0; i < count; i++) {
      cards.push({
        question: `Question number ${i} with some content and explanations to consume buffer space?`,
        options: {
          a: `Option A for question ${i}`,
          b: `Option B for question ${i}`,
          c: `Option C for question ${i}`,
          d: `Option D for question ${i}`,
        },
        answer: "a",
        explanation: `Explanation for question ${i} with details and analysis.`,
      });
    }

    const raw = JSON.stringify(cards);
    const parsedResult = await parser.parse(raw);
    const item: InputDeckItem = {
      parsedResult,
      parser,
      deckName: "LargeDeckTest",
    };

    const outputPath = path.resolve(process.cwd(), "test_large_deck.apkg");
    try {
      await generateApkg(item, outputPath);
      assert.ok(fs.existsSync(outputPath), "APKG file should be created successfully");
      const stat = fs.statSync(outputPath);
      assert.ok(stat.size > 0, "APKG file size should be > 0");
    } finally {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    }
  });
});
