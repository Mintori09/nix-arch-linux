import { test, describe } from "node:test";
import assert from "node:assert";
import { MCQShuffleParser } from "../../src/parsers/mcq-shuffle.js";

const MCQ_ITEM = {
  question: "Kiểm thử phần mềm là:",
  options: {
    a: "Chứng minh không có lỗi.",
    b: "Xác lập độ tin cậy.",
    c: "Thực thi và chỉ ra đúng đặc tả.",
    d: "Thực thi để tìm ra lỗi.",
  },
  answer: "d",
  explanation: "Kiểm thử là tìm lỗi.",
};

describe("MCQShuffleParser", () => {
  test("template name must be mcq-shuffle", () => {
    const parser = new MCQShuffleParser();
    assert.strictEqual(parser.getTemplateName(), "mcq-shuffle");
  });

  test("parses mcq payload with same schema as MCQParser", async () => {
    const parser = new MCQShuffleParser();
    const result = await parser.parse(JSON.stringify([MCQ_ITEM]));
    assert.strictEqual(result.cards.length, 1);
    assert.ok(result.cards[0].fields["OptionsB64"]);
    assert.ok(result.cards[0].fields["CorrectAnswersB64"]);
  });
});
