import { test, describe } from "node:test";
import assert from "node:assert";
import path from "node:path";
import os from "node:os";
import getFileData from "../../src/utils/resolve-filepath.js";

describe("resolve-filepath: getFileData()", () => {
  test("đường dẫn tuyệt đối được trả về nguyên vẹn", () => {
    const result = getFileData("/home/user/vocab.json");
    assert.strictEqual(result.jsonPath, "/home/user/vocab.json");
    assert.strictEqual(result.fileName, "vocab.json");
  });

  test("đường dẫn tương đối được resolve về cwd", () => {
    const result = getFileData("./input/data.json");
    assert.strictEqual(result.jsonPath, path.resolve(process.cwd(), "./input/data.json"));
    assert.strictEqual(result.fileName, "data.json");
  });

  test("tên file không có extension vẫn được trả đúng", () => {
    const result = getFileData("/tmp/myfile");
    assert.strictEqual(result.fileName, "myfile");
  });

  test("mở rộng ~/ thành homedir()", () => {
    const result = getFileData("~/Documents/data.json");
    assert.strictEqual(result.jsonPath, path.join(os.homedir(), "/Documents/data.json"));
    assert.strictEqual(result.fileName, "data.json");
  });

  test("input rỗng gọi process.exit(-1)", () => {
    // Spy on process.exit mà không thực sự exit
    let exitCode: number | undefined;
    const original = process.exit.bind(process);
    // @ts-ignore
    process.exit = (code: number) => {
      exitCode = code;
      throw new Error("exit");
    };
    try {
      getFileData("");
    } catch (_) {}
    // @ts-ignore
    process.exit = original;
    assert.strictEqual(exitCode, -1);
  });
});
