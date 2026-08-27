import { test, describe } from "node:test";
import assert from "node:assert";
import http from "node:http";
import {
  renderCardHtml,
  buildPreviewAppHtml,
  startPreviewServer,
} from "../../src/core/preview-server.js";
import { VocabParser } from "../../src/parsers/vocab.js";
import type { InputDeckItem } from "../../src/core/generator.js";

describe("Preview Server", () => {
  test("renderCardHtml correctly replaces placeholders and sections", () => {
    const frontHtml = '<div class="front">{{Word}}{{#Audio}} {{Audio}}{{/Audio}}</div>';
    const backHtml = '<div class="back">{{Definition}}</div>';
    const css = ".card { color: red; }";
    const fieldNames = ["Word", "Audio", "Definition"];

    const rendered = renderCardHtml(frontHtml, backHtml, css, fieldNames, {
      Word: "Apple",
      Audio: "[sound:apple.mp3]",
      Definition: "A round fruit",
    });

    assert.strictEqual(rendered.front, '<div class="front">Apple [sound:apple.mp3]</div>');
    assert.strictEqual(rendered.back, '<div class="back">A round fruit</div>');
  });

  test("buildPreviewAppHtml produces complete HTML page with cards", () => {
    const parser = new VocabParser();
    const items: InputDeckItem[] = [
      {
        deckName: "TestDeck",
        parser,
        parsedResult: {
          cards: [
            {
              frontKeyField: "Book",
              fields: {
                Word: "Book",
                Definition: "A set of written pages",
              },
            },
          ],
          media: [],
        },
      },
    ];

    const html = buildPreviewAppHtml(items);
    assert.ok(html.includes("Anki Flashcard Previewer"));
    assert.ok(html.includes("TestDeck"));
    assert.ok(html.includes("Book"));
  });

  test("startPreviewServer serves HTTP index and handles requests", async () => {
    const parser = new VocabParser();
    const items: InputDeckItem[] = [
      {
        deckName: "TestDeck",
        parser,
        parsedResult: {
          cards: [
            {
              frontKeyField: "Cat",
              fields: {
                Word: "Cat",
                Definition: "A small domesticated carnivorous mammal",
              },
            },
          ],
          media: [],
        },
      },
    ];

    const handle = await startPreviewServer(async () => items, [], 3456);

    const resBody = await new Promise<string>((resolve, reject) => {
      http.get(`http://localhost:${handle.port}/`, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(body));
        res.on("error", reject);
      });
    });

    assert.ok(resBody.includes("Cat"));
    handle.stop();
  });
});
