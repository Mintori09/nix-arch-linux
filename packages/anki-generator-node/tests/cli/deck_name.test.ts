import { test, describe } from "node:test";
import assert from "node:assert";
import path from "node:path";
import { resolveDeckAndOutputNames } from "../../src/utils/deck-resolver.js";

describe("Deck and Output Name Resolver", () => {
  test("single file without deck-name flag uses file basename", () => {
    const inputPaths = ["data/animals.json"];
    const result = resolveDeckAndOutputNames(inputPaths, undefined);

    assert.strictEqual(result.masterOutputName, "animals");
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].deckName, "data::animals");
  });

  test("single file with custom deck-name flag", () => {
    const inputPaths = ["data/animals.json"];
    const result = resolveDeckAndOutputNames(inputPaths, "English::Animals");

    assert.strictEqual(result.masterOutputName, "English__Animals");
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].deckName, "English::Animals");
  });

  test("multiple files with custom root deck-name flag", () => {
    const inputPaths = ["lessons/ch1.json", "lessons/ch2.json"];
    const result = resolveDeckAndOutputNames(inputPaths, "Biology 101");

    assert.strictEqual(result.masterOutputName, "Biology 101");
    assert.strictEqual(result.items.length, 2);
    assert.strictEqual(result.items[0].deckName, "Biology 101::ch1");
    assert.strictEqual(result.items[1].deckName, "Biology 101::ch2");
  });

  test("multiple files in same parent folder without deck-name uses parent folder", () => {
    const inputPaths = ["lessons/ch1.json", "lessons/ch2.json"];
    const result = resolveDeckAndOutputNames(inputPaths, undefined);

    assert.strictEqual(result.masterOutputName, "lessons");
    assert.strictEqual(result.items.length, 2);
    assert.strictEqual(result.items[0].deckName, "lessons::ch1");
    assert.strictEqual(result.items[1].deckName, "lessons::ch2");
  });
});
