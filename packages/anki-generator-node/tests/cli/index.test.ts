import { test, describe } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(
  import.meta.dirname || path.dirname(new URL(import.meta.url).pathname),
  "../..",
);

function runCli(args: string[]): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync("node", ["dist/index.js", ...args], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    timeout: 5000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

describe("CLI Mode: --prompt (Prompt Retrieval)", () => {
  test("59: --prompt không đối số -> in danh sách short name kèm kích thước", () => {
    const { stdout, stderr, status } = runCli(["--prompt"]);
    assert.strictEqual(status, 0);
    assert.strictEqual(stderr, "");
    assert.ok(stdout.includes("anki-flashcard-english-vocab"));
    assert.ok(stdout.includes("mcq-creation"));
    assert.ok(/anki-flashcard-english-vocab \(\d+\.\d+ KB\)/.test(stdout));
    assert.ok(/mcq-creation \(\d+\.\d+ KB\)/.test(stdout));
  });

  test("60: --prompt với tên anki-flashcard-english-vocab -> in raw content", () => {
    const { stdout, stderr, status } = runCli(["--prompt", "anki-flashcard-english-vocab"]);
    assert.strictEqual(status, 0);
    assert.strictEqual(stderr, "");
    const realContent = fs.readFileSync(
      path.join(PROJECT_ROOT, "assets", "prompt-anki-flashcard-english-vocab.md"),
      "utf-8",
    );
    assert.strictEqual(stdout, realContent);
  });

  test("61: --prompt với tên mcq-creation -> in raw content", () => {
    const { stdout, stderr, status } = runCli(["--prompt", "mcq-creation"]);
    assert.strictEqual(status, 0);
    assert.strictEqual(stderr, "");
    const realContent = fs.readFileSync(
      path.join(PROJECT_ROOT, "assets", "prompt-mcq-creation.md"),
      "utf-8",
    );
    assert.strictEqual(stdout, realContent);
  });

  test("62: --prompt với tên không tồn tại -> lỗi và danh sách options", () => {
    const { stdout, stderr, status } = runCli(["--prompt", "invalid-name-123"]);
    assert.strictEqual(status, 1);
    assert.strictEqual(stdout, "");
    assert.ok(stderr.includes("Error: Prompt template 'invalid-name-123' not found."));
    assert.ok(stderr.includes("anki-flashcard-english-vocab"));
    assert.ok(stderr.includes("mcq-creation"));
  });

  test("63: --prompt --type cùng lúc -> lỗi mutual exclusivity", () => {
    const { stdout, stderr, status } = runCli([
      "--prompt",
      "mcq-creation",
      "--type",
      "vocab",
      "data.json",
    ]);
    assert.strictEqual(status, 1);
    assert.strictEqual(stdout, "");
    assert.ok(
      stderr.includes(
        "Error: --type, --export, --prompt, and --autocomplete are mutually exclusive",
      ),
    );
  });

  test("64: --prompt --export cùng lúc -> lỗi mutual exclusivity", () => {
    const { stdout, stderr, status } = runCli([
      "--prompt",
      "mcq-creation",
      "--export",
      "a.apkg",
      "./out",
    ]);
    assert.strictEqual(status, 1);
    assert.strictEqual(stdout, "");
    assert.ok(
      stderr.includes(
        "Error: --type, --export, --prompt, and --autocomplete are mutually exclusive",
      ),
    );
  });

  test("65: assets/ không tồn tại -> lỗi assets directory not found", () => {
    const assetsDir = path.join(PROJECT_ROOT, "assets");
    const tempAssetsDir = path.join(PROJECT_ROOT, "assets_temp_backup");

    if (fs.existsSync(assetsDir)) {
      fs.renameSync(assetsDir, tempAssetsDir);
    }
    try {
      const { stdout, stderr, status } = runCli(["--prompt"]);
      assert.strictEqual(status, 1);
      assert.strictEqual(stdout, "");
      assert.ok(stderr.includes("Error: assets directory not found."));
    } finally {
      if (fs.existsSync(tempAssetsDir)) {
        fs.renameSync(tempAssetsDir, assetsDir);
      }
    }
  });

  test("66: pipe output từ --prompt -> chỉ chứa raw content", () => {
    const { stdout, stderr, status } = runCli(["--prompt", "mcq-creation"]);
    assert.strictEqual(status, 0);
    assert.strictEqual(stderr, "");
    // Check stdout begins with expected markdown header directly
    assert.ok(stdout.startsWith("Bạn là một công cụ"));
  });
});

describe("CLI Mode: --autocomplete (Autocomplete Output)", () => {
  test("67: --autocomplete -> in raw content của completions/_anki-tool", () => {
    const { stdout, stderr, status } = runCli(["--autocomplete"]);
    assert.strictEqual(status, 0);
    assert.strictEqual(stderr, "");
    const realContent = fs.readFileSync(
      path.join(PROJECT_ROOT, "completions", "_anki-tool"),
      "utf-8",
    );
    assert.strictEqual(stdout, realContent);
  });

  test("68: --autocomplete --export cùng lúc -> lỗi mutual exclusivity", () => {
    const { stdout, stderr, status } = runCli(["--autocomplete", "--export", "a.apkg", "./out"]);
    assert.strictEqual(status, 1);
    assert.strictEqual(stdout, "");
    assert.ok(
      stderr.includes(
        "Error: --type, --export, --prompt, and --autocomplete are mutually exclusive",
      ),
    );
  });

  test("69: completions/_anki-tool không tồn tại -> lỗi script not found", () => {
    const completionsDir = path.join(PROJECT_ROOT, "completions");
    const tempCompletionsDir = path.join(PROJECT_ROOT, "completions_temp_backup");

    if (fs.existsSync(completionsDir)) {
      fs.renameSync(completionsDir, tempCompletionsDir);
    }
    try {
      const { stdout, stderr, status } = runCli(["--autocomplete"]);
      assert.strictEqual(status, 1);
      assert.strictEqual(stdout, "");
      assert.ok(stderr.includes("Error: Completion script not found"));
    } finally {
      if (fs.existsSync(tempCompletionsDir)) {
        fs.renameSync(tempCompletionsDir, completionsDir);
      }
    }
  });
});

describe("CLI Mode: Mutual Exclusivity & Usages", () => {
  test("70: không flag nào -> in hướng dẫn và lỗi", () => {
    const { stdout, stderr, status } = runCli([]);
    assert.strictEqual(status, 1);
    assert.strictEqual(stdout, "");
    assert.ok(stderr.includes("Terminal Usage Error:"));
  });

  test("71: --prompt --autocomplete cùng lúc -> lỗi mutual exclusivity", () => {
    const { stdout, stderr, status } = runCli(["--prompt", "--autocomplete"]);
    assert.strictEqual(status, 1);
    assert.strictEqual(stdout, "");
    assert.ok(
      stderr.includes(
        "Error: --type, --export, --prompt, and --autocomplete are mutually exclusive",
      ),
    );
  });

  test("72: --autocomplete --type cùng lúc -> lỗi mutual exclusivity", () => {
    const { stdout, stderr, status } = runCli(["--autocomplete", "--type", "vocab", "data.json"]);
    assert.strictEqual(status, 1);
    assert.strictEqual(stdout, "");
    assert.ok(
      stderr.includes(
        "Error: --type, --export, --prompt, and --autocomplete are mutually exclusive",
      ),
    );
  });

  test("73: --type basic với đường dẫn subfolder -> tạo subdeck dưới deck_cha", () => {
    const tmpDir = path.join(PROJECT_ROOT, "tests", "tmp_multi_test");
    const subFolder = path.join(tmpDir, "my_deck");
    if (!fs.existsSync(subFolder)) fs.mkdirSync(subFolder, { recursive: true });

    const file1 = path.join(subFolder, "lesson1.json");
    const file2 = path.join(subFolder, "lesson2.json");
    const relFile1 = path.relative(PROJECT_ROOT, file1);
    const relFile2 = path.relative(PROJECT_ROOT, file2);

    const sample1 = [{ front: "Hello", back: "Xin chào" }];
    const sample2 = [{ front: "World", back: "Thế giới" }];

    fs.writeFileSync(file1, JSON.stringify(sample1), "utf-8");
    fs.writeFileSync(file2, JSON.stringify(sample2), "utf-8");

    try {
      const { stdout, stderr, status } = runCli(["--type", "basic", relFile1, relFile2]);
      if (status !== 0) {
        console.error("CLI STDERR:", stderr);
        console.error("CLI STDOUT:", stdout);
      }
      assert.strictEqual(status, 0);
      assert.ok(stdout.includes("Compiling payload [lesson1.json]"));
      assert.ok(stdout.includes("Compiling payload [lesson2.json]"));
      assert.ok(stdout.includes("Success! Exported my_deck.apkg"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("73b: --type basic với đường dẫn nested subfolder (toiec/reading/...) -> tạo multi-level deck", () => {
    const tmpDir = path.join(PROJECT_ROOT, "tests", "tmp_nested_test");
    const nestedFolder = path.join(tmpDir, "toiec", "reading");
    if (!fs.existsSync(nestedFolder)) fs.mkdirSync(nestedFolder, { recursive: true });

    const file1 = path.join(nestedFolder, "part5.json");
    const file2 = path.join(nestedFolder, "part6.json");
    const relFile1 = path.join("tests", "tmp_nested_test", "toiec", "reading", "part5.json");
    const relFile2 = path.join("tests", "tmp_nested_test", "toiec", "reading", "part6.json");

    const sample1 = [{ front: "Q1", back: "A1" }];
    const sample2 = [{ front: "Q2", back: "A2" }];

    fs.writeFileSync(file1, JSON.stringify(sample1), "utf-8");
    fs.writeFileSync(file2, JSON.stringify(sample2), "utf-8");

    try {
      const { stdout, stderr, status } = runCli(["--type", "basic", relFile1, relFile2]);
      if (status !== 0) {
        console.error("CLI STDERR:", stderr);
        console.error("CLI STDOUT:", stdout);
      }
      assert.strictEqual(status, 0);
      assert.ok(stdout.includes("Compiling payload [part5.json]"));
      assert.ok(stdout.includes("Compiling payload [part6.json]"));
      assert.ok(stdout.includes("Success! Exported reading.apkg"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("74: truyền các file JSON lẻ -> mỗi file json là một deck độc lập tương ứng với tên file", () => {
    const tmpDir = path.join(PROJECT_ROOT, "tests", "tmp_single_files_test");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const fileA = path.join(tmpDir, "topic_a.json");
    const fileB = path.join(tmpDir, "topic_b.json");

    fs.writeFileSync(fileA, JSON.stringify([{ front: "A", back: "B" }]), "utf-8");
    fs.writeFileSync(fileB, JSON.stringify([{ front: "C", back: "D" }]), "utf-8");

    try {
      const { stdout, status } = runCli(["--type", "basic", fileA, fileB]);
      assert.strictEqual(status, 0);
      assert.ok(stdout.includes("Compiling payload [topic_a.json]"));
      assert.ok(stdout.includes("Compiling payload [topic_b.json]"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("75: --deck-name tuỳ biến tên deck và tên file xuất ra", () => {
    const tmpDir = path.join(PROJECT_ROOT, "tests", "tmp_custom_deck_cli");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const fileA = path.join(tmpDir, "lesson.json");
    fs.writeFileSync(fileA, JSON.stringify([{ front: "Hello", back: "World" }]), "utf-8");

    try {
      const { stdout, status } = runCli([
        "--type",
        "basic",
        fileA,
        "--deck-name",
        "MyCourse::Lesson1",
      ]);
      assert.strictEqual(status, 0);
      assert.ok(stdout.includes("Success! Exported MyCourse__Lesson1.apkg"));
      assert.ok(fs.existsSync(path.join(tmpDir, "MyCourse__Lesson1.apkg")));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
