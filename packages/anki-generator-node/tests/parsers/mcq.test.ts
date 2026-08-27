import { test, describe } from "node:test";
import assert from "node:assert";
import { MCQParser } from "../../src/parsers/mcq.js";

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

function decodeB64Json(b64: string): unknown {
  return JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
}

describe("MCQParser", () => {
  test("4 đáp án → OptionsB64 decode ra mảng 4 phần tử", async () => {
    const parser = new MCQParser();
    const result = await parser.parse(JSON.stringify([MCQ_ITEM]));
    const options = decodeB64Json(result.cards[0].fields["OptionsB64"] ?? "") as any[];
    assert.strictEqual(options.length, 4);
  });

  test("mỗi option có đủ key, label, text", async () => {
    const parser = new MCQParser();
    const result = await parser.parse(JSON.stringify([MCQ_ITEM]));
    const options = decodeB64Json(result.cards[0].fields["OptionsB64"] ?? "") as any[];
    for (const opt of options) {
      assert.ok("key" in opt && "label" in opt && "text" in opt);
    }
  });

  test("chỉ 2 đáp án → OptionsB64 decode ra mảng 2 phần tử", async () => {
    const parser = new MCQParser();
    const item = { ...MCQ_ITEM, options: { a: "Đúng", b: "Sai" }, answer: "a" };
    const result = await parser.parse(JSON.stringify([item]));
    const options = decodeB64Json(result.cards[0].fields["OptionsB64"] ?? "") as any[];
    assert.strictEqual(options.length, 2);
  });

  test("đáp án chữ thường → CorrectAnswersB64 decode ra ['d']", async () => {
    const parser = new MCQParser();
    const result = await parser.parse(JSON.stringify([MCQ_ITEM]));
    const answers = decodeB64Json(result.cards[0].fields["CorrectAnswersB64"] ?? "") as string[];
    assert.deepStrictEqual(answers, ["d"]);
  });

  test("đáp án chữ hoa → normalize về lowercase", async () => {
    const parser = new MCQParser();
    const item = { ...MCQ_ITEM, answer: "D" };
    const result = await parser.parse(JSON.stringify([item]));
    const answers = decodeB64Json(result.cards[0].fields["CorrectAnswersB64"] ?? "") as string[];
    assert.deepStrictEqual(answers, ["d"]);
  });

  test("nhiều đáp án đúng phân tách bằng dấu phẩy", async () => {
    const parser = new MCQParser();
    const item = { ...MCQ_ITEM, answer: "a, c" };
    const result = await parser.parse(JSON.stringify([item]));
    const answers = decodeB64Json(result.cards[0].fields["CorrectAnswersB64"] ?? "") as string[];
    assert.deepStrictEqual(answers, ["a", "c"]);
  });

  test("question có inline code → được convert sang <code>", async () => {
    const parser = new MCQParser();
    const item = { ...MCQ_ITEM, question: "What does `typeof null` return?" };
    const result = await parser.parse(JSON.stringify([item]));
    assert.ok(result.cards[0].fields["Question"]?.includes("<code>typeof null</code>"));
  });

  test("explanation có markdown bold **text** → được convert sang <strong>text</strong>", async () => {
    const parser = new MCQParser();
    const item = { ...MCQ_ITEM, explanation: "• **Đúng (b):** Giải thích" };
    const result = await parser.parse(JSON.stringify([item]));
    assert.ok(
      result.cards[0].fields["Explanation"]?.includes("• <strong>Đúng (b):</strong> Giải thích"),
    );
  });

  test("media luôn là mảng rỗng", async () => {
    const parser = new MCQParser();
    const result = await parser.parse(JSON.stringify([MCQ_ITEM]));
    assert.deepStrictEqual(result.media, []);
  });

  test("OptionsB64 là chuỗi base64 hợp lệ (parse được thành JSON)", async () => {
    const parser = new MCQParser();
    const result = await parser.parse(JSON.stringify([MCQ_ITEM]));
    const b64 = result.cards[0].fields["OptionsB64"] ?? "";
    assert.doesNotThrow(() => decodeB64Json(b64));
    assert.ok(Array.isArray(decodeB64Json(b64)));
  });
});
