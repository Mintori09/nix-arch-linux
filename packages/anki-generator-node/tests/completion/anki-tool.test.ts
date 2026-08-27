import { test, describe } from "node:test";
import assert from "node:assert";
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const COMPLETION_FILE = path.join(PROJECT_ROOT, "completions", "_anki-tool");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function zsh(script: string): { stdout: string; stderr: string; ok: boolean } {
  const result = spawnSync("zsh", ["-c", script], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    timeout: 5000,
  });
  return {
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
    ok: result.status === 0,
  };
}

function readCompletionFile(): string {
  return fs.readFileSync(COMPLETION_FILE, "utf-8");
}

// ─── Suite 1: File System ─────────────────────────────────────────────────────

describe("Completion file: filesystem", () => {
  test("file _anki-tool tồn tại trong thư mục completions/", () => {
    assert.ok(fs.existsSync(COMPLETION_FILE), `Missing: ${COMPLETION_FILE}`);
  });

  test("file không rỗng", () => {
    const size = fs.statSync(COMPLETION_FILE).size;
    assert.ok(size > 0, "File rỗng");
  });
});

// ─── Suite 2: Header & Structure ──────────────────────────────────────────────

describe("Completion file: header và cấu trúc", () => {
  test("có #compdef directive hợp lệ ở dòng đầu tiên", () => {
    const firstLine = readCompletionFile().split("\n")[0];
    assert.ok(
      firstLine.startsWith("#compdef"),
      `Dòng đầu tiên phải bắt đầu bằng #compdef, thực tế: "${firstLine}"`,
    );
  });

  test("#compdef đăng ký 'node\\ src/index.js'", () => {
    const header = readCompletionFile().split("\n")[0];
    assert.ok(header.includes("src/index.js"), `Thiếu src/index.js trong #compdef: "${header}"`);
  });

  test("#compdef đăng ký 'node\\ dist/index.js'", () => {
    const header = readCompletionFile().split("\n")[0];
    assert.ok(header.includes("dist/index.js"), `Thiếu dist/index.js trong #compdef: "${header}"`);
  });

  test("#compdef đăng ký 'anki-tool'", () => {
    const header = readCompletionFile().split("\n")[0];
    assert.ok(header.includes("anki-tool"), `Thiếu anki-tool trong #compdef: "${header}"`);
  });

  test("định nghĩa hàm _anki_tool()", () => {
    const src = readCompletionFile();
    assert.ok(src.includes("_anki_tool()"), "Thiếu định nghĩa hàm _anki_tool()");
  });

  test("có lời gọi _anki_tool cuối file để kích hoạt", () => {
    const lines = readCompletionFile()
      .split("\n")
      .filter((l) => l.trim());
    const last = lines[lines.length - 1];
    assert.ok(last.includes("_anki_tool"), `Dòng cuối phải gọi _anki_tool, thực tế: "${last}"`);
  });
});

// ─── Suite 3: Zsh Syntax ──────────────────────────────────────────────────────

describe("Completion file: cú pháp zsh", () => {
  test("zsh -n không báo lỗi cú pháp (syntax check)", () => {
    const result = zsh(`zsh -n "${COMPLETION_FILE}"`);
    assert.ok(result.ok, `Lỗi cú pháp zsh:\n${result.stderr}`);
    assert.strictEqual(result.stderr, "", `Cảnh báo từ zsh -n:\n${result.stderr}`);
  });

  test("hàm _anki_tool load được và được nhận diện là function", () => {
    const result = zsh(`
      fpath=("${PROJECT_ROOT}/completions" $fpath)
      autoload -Uz compinit && compinit -u 2>/dev/null
      autoload -Uz _anki_tool
      declare -f _anki_tool > /dev/null 2>&1 && echo OK
    `);
    assert.strictEqual(result.stdout, "OK", `_anki_tool không load được:\n${result.stderr}`);
  });
});

// ─── Suite 4: Completion Patterns ────────────────────────────────────────────

describe("Completion file: nội dung pattern hoàn chỉnh", () => {
  let src: string;
  // Read once for all pattern tests
  test("đọc nội dung file", () => {
    src = readCompletionFile();
    assert.ok(src.length > 0);
  });

  test("sử dụng _arguments cho flag parsing", () => {
    assert.ok(src.includes("_arguments"), "Thiếu _arguments");
  });

  test("cờ --type và -type được khai báo", () => {
    assert.ok(src.includes("--type") && src.includes("-type"), "Thiếu khai báo --type / -type");
  });

  test("cờ --export và -export được khai báo", () => {
    assert.ok(
      src.includes("--export") && src.includes("-export"),
      "Thiếu khai báo --export / -export",
    );
  });

  test("loại trừ lẫn nhau: --type cấm --export", () => {
    assert.ok(
      src.includes("(-export --export") || src.includes("(-type --type"),
      "Thiếu exclusion group cho mutual exclusion giữa --type và --export",
    );
  });

  test("các cờ mới được khai báo: --deck-name, --watch, --preview, --port", () => {
    assert.ok(src.includes("--deck-name"), "Thiếu --deck-name");
    assert.ok(src.includes("--watch"), "Thiếu --watch");
    assert.ok(src.includes("--preview"), "Thiếu --preview");
    assert.ok(src.includes("--port"), "Thiếu --port");
  });

  test("các giá trị parser type: vocab, grammar, mcq, mcq-shuffle, basic, jp_vocab, jp_grammar", () => {
    assert.ok(src.includes("vocab"), "Thiếu vocab");
    assert.ok(src.includes("grammar"), "Thiếu grammar");
    assert.ok(src.includes("mcq"), "Thiếu mcq");
    assert.ok(src.includes("mcq-shuffle"), "Thiếu mcq-shuffle");
    assert.ok(src.includes("basic"), "Thiếu basic");
    assert.ok(src.includes("jp_vocab"), "Thiếu jp_vocab");
    assert.ok(src.includes("jp_grammar"), "Thiếu jp_grammar");
  });

  test('filter file JSON: _files -g "*.json"', () => {
    assert.ok(src.includes("*.json"), `Thiếu filter *.json trong completion script`);
  });

  test('filter file .apkg cho --export: _files -g "*.apkg"', () => {
    assert.ok(src.includes("*.apkg"), `Thiếu filter *.apkg trong completion script`);
  });
});

// ─── Suite 5: Zsh Load Sanity ────────────────────────────────────────────────

describe("Completion file: load và gọi an toàn", () => {
  test("source file không throw lỗi trong zsh sạch", () => {
    const result = zsh(`
      fpath=("${PROJECT_ROOT}/completions" $fpath)
      autoload -Uz compinit && compinit -u 2>/dev/null
      source "${COMPLETION_FILE}" 2>&1 && echo OK
    `);
    assert.ok(
      result.stdout.includes("OK"),
      `Source file bị lỗi:\n${result.stderr}\n${result.stdout}`,
    );
  });

  test("gọi _anki_tool không crash khi không có completion context", () => {
    const result = zsh(`
      fpath=("${PROJECT_ROOT}/completions" $fpath)
      autoload -Uz compinit && compinit -u 2>/dev/null
      autoload -Uz _anki_tool
      # Gọi trong context rỗng - không nên crash
      _anki_tool 2>/dev/null || true
      echo DONE
    `);
    assert.ok(
      result.stdout.includes("DONE"),
      `Hàm crash khi gọi không có context:\n${result.stderr}`,
    );
  });
});
