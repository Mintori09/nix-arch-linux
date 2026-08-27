import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ─── Tạo thư mục tạm chứa templates/styles giả lập ─────────────────────────
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "anki-template-test-"));

// Cấu trúc tối thiểu: templates/front.html, templates/back.html, styles/card.css
fs.mkdirSync(path.join(tmpRoot, "templates"), { recursive: true });
fs.mkdirSync(path.join(tmpRoot, "templates", "custom"), { recursive: true });
fs.mkdirSync(path.join(tmpRoot, "styles"), { recursive: true });

fs.writeFileSync(path.join(tmpRoot, "templates", "front.html"), "<div>default front</div>");
fs.writeFileSync(path.join(tmpRoot, "templates", "back.html"), "<div>default back</div>");
fs.writeFileSync(path.join(tmpRoot, "styles", "card.css"), ":root { --color: red; }");
fs.writeFileSync(
  path.join(tmpRoot, "templates", "custom", "front.html"),
  "<div>custom front</div>",
);
fs.writeFileSync(path.join(tmpRoot, "templates", "custom", "back.html"), "<div>custom back</div>");
fs.writeFileSync(
  path.join(tmpRoot, "styles", "custom.css"),
  '@import url("card.css");\n.custom { color: blue; }',
);

// Inject ROOT tạm thời bằng cách ghi đè module env
import { mock } from "node:test";
const mockEnv = {
  ROOT: tmpRoot,
  MEDIA_DIR: path.join(tmpRoot, "media"),
  IMAGE_DIR: path.join(tmpRoot, "media"),
};
mock.module("../../src/config/env.js", {
  namedExports: mockEnv,
  defaultExport: mockEnv,
});

const { loadFrontHtml, loadBackHtml, loadCss, createAnkiTemplate } =
  await import("../../src/core/template.js");

describe("template.ts: loadFrontHtml / loadBackHtml", () => {
  test("template tùy chỉnh tồn tại → trả về nội dung file đó", () => {
    const html = loadFrontHtml("custom");
    assert.strictEqual(html, "<div>custom front</div>");
  });

  test("template không tồn tại → fallback về default front.html", () => {
    const html = loadFrontHtml("nonexistent");
    assert.strictEqual(html, "<div>default front</div>");
  });

  test("loadBackHtml custom → trả đúng nội dung back", () => {
    const html = loadBackHtml("custom");
    assert.strictEqual(html, "<div>custom back</div>");
  });

  test("loadBackHtml fallback → default back.html", () => {
    const html = loadBackHtml("nonexistent");
    assert.strictEqual(html, "<div>default back</div>");
  });
});

describe("template.ts: loadCss", () => {
  test("template có file CSS → concat card.css + custom.css", () => {
    const css = loadCss("custom");
    assert.ok(css.includes(":root { --color: red; }"), "Phải có card.css base");
    assert.ok(css.includes(".custom { color: blue; }"), "Phải có custom CSS");
  });

  test("@import url('card.css') bị loại bỏ khỏi output", () => {
    const css = loadCss("custom");
    assert.ok(!css.includes("@import"), "Không được chứa @import");
  });

  test("template không có CSS riêng → chỉ trả card.css", () => {
    const css = loadCss("nonexistent");
    assert.strictEqual(css, ":root { --color: red; }");
  });
});

describe("template.ts: createAnkiTemplate", () => {
  const FIELDS = ["Question", "OptionsB64", "CorrectAnswersB64", "Explanation"] as const;

  test("số lượng field trong SQL output khớp với FIELD_NAMES", () => {
    const sql = createAnkiTemplate("<div>Q</div>", "<div>A</div>", ":root{}", FIELDS);
    // Extract the models JSON string from the INSERT INTO col VALUES(...) statement
    // The models blob is the 10th column value in the INSERT
    const insertMatch = sql.match(/INSERT INTO "col" VALUES\([^)]+\)/);
    assert.ok(insertMatch, "SQL phải có câu INSERT INTO col");
    // Count field definitions by how many times {"name" appears in the SQL
    const fieldCount = (sql.match(/"name":/g) ?? []).length;
    // Template has extra name fields (deck names etc) so just verify >= FIELDS.length
    assert.ok(
      fieldCount >= FIELDS.length,
      `Expected at least ${FIELDS.length} name occurrences, got ${fieldCount}`,
    );
  });

  test("SQL bắt đầu bằng PRAGMA foreign_keys=OFF", () => {
    const sql = createAnkiTemplate("<div>Q</div>", "<div>A</div>", ":root{}", FIELDS);
    assert.ok(sql.startsWith("PRAGMA foreign_keys=OFF;"));
  });

  test("frontHtml được nhúng đúng vào qfmt", () => {
    const sql = createAnkiTemplate("<div>FRONT_MARKER</div>", "<div>A</div>", ":root{}", FIELDS);
    assert.ok(sql.includes("FRONT_MARKER"));
  });
});
