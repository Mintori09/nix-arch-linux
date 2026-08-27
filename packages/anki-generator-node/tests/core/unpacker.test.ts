import { test, describe, mock } from "node:test";
import assert from "node:assert";

// Mock child_process and fs
let execSyncCalls: string[] = [];
let writeFileSyncCalls: Array<[string, string]> = [];
let copyFileSyncCalls: Array<[string, string]> = [];

const mockExecSync = (cmd: string) => {
  execSyncCalls.push(cmd);
  return Buffer.from("");
};

mock.module("node:child_process", {
  namedExports: { execSync: mockExecSync },
  defaultExport: { execSync: mockExecSync },
});

const mockFs = {
  existsSync: (p: string) => {
    if (p.includes(".apkg")) return true;
    if (p.includes("collection.anki21")) return true;
    if (p.includes("media")) return true;
    if (/\/\d+$/.test(p)) return true;
    return false;
  },
  mkdirSync: () => {},
  mkdtempSync: () => "/tmp/anki-unpack-mock",
  readFileSync: (p: string) => {
    if (p.includes("media")) {
      return Buffer.from(JSON.stringify({ "0": "audio.mp3", "1": "image.png" }));
    }
    return Buffer.from("SQLite format 3\0");
  },
  writeFileSync: (p: string, data: string) => {
    writeFileSyncCalls.push([p, data]);
  },
  copyFileSync: (src: string, dest: string) => {
    copyFileSyncCalls.push([src, dest]);
  },
  rmSync: () => {},
};

mock.module("node:fs", {
  namedExports: mockFs,
  defaultExport: mockFs,
});

const mockCreateRequire = () => {
  const mockRequire = (id: string) => {
    if (id === "sql.js" || id.includes("sql.js")) {
      return {
        Database: class MockDatabase {
          exec(sql: string) {
            if (sql.includes("FROM col")) {
              return [
                {
                  columns: ["models"],
                  values: [
                    [
                      JSON.stringify({
                        "100": {
                          name: "TestModel",
                          flds: [
                            { name: "Word", ord: 0 },
                            { name: "IPA", ord: 1 },
                          ],
                        },
                      }),
                    ],
                  ],
                },
              ];
            }
            if (sql.includes("FROM notes")) {
              return [
                {
                  columns: ["id", "mid", "flds", "tags"],
                  values: [[1, 100, "hello\u001fhello\u001f/həˈloʊ/", "tag1 tag2"]],
                },
              ];
            }
            return [];
          }
        },
      };
    }
    return { resolve: () => "/dummy/path" };
  };
  mockRequire.resolve = () => "/dummy/path";
  return mockRequire;
};

import * as realModule from "node:module";

// Mock node:module to return a mock sql.js
mock.module("node:module", {
  namedExports: {
    ...realModule,
    createRequire: mockCreateRequire,
  },
  defaultExport: {
    ...(realModule.default || {}),
    createRequire: mockCreateRequire,
  },
});

// Mock anki-apkg-export since it is required dynamically
mock.module("anki-apkg-export", {
  exports: {
    Exporter: class {},
  },
});

const { unpackApkg } = await import("../../src/core/unpacker.js");

function resetMockCalls() {
  execSyncCalls = [];
  writeFileSyncCalls = [];
  copyFileSyncCalls = [];
}

describe("unpacker.ts: unpackApkg", () => {
  test("thực hiện unzip file apkg chính xác", async () => {
    resetMockCalls();
    await unpackApkg("mydeck.apkg", "outdir");
    assert.ok(execSyncCalls.some((c) => c.includes("unzip") && c.includes("mydeck.apkg")));
  });

  test("map chính xác các trường của notes và xuất ra cards.json", async () => {
    resetMockCalls();
    await unpackApkg("mydeck.apkg", "outdir");
    const cardsJsonWrite = writeFileSyncCalls.find(([p]) => p.includes("cards.json"));
    assert.ok(cardsJsonWrite, "Phải ghi file cards.json");

    const cards = JSON.parse(cardsJsonWrite[1]);
    assert.strictEqual(cards.length, 1);
    assert.strictEqual(cards[0].id, 1);
    assert.strictEqual(cards[0].modelName, "TestModel");
    assert.deepStrictEqual(cards[0].fields, {
      Word: "hello",
      IPA: "/həˈloʊ/",
    });
    assert.deepStrictEqual(cards[0].tags, ["tag1", "tag2"]);
  });

  test("phục hồi tên file gốc của các file media", async () => {
    resetMockCalls();
    await unpackApkg("mydeck.apkg", "outdir");
    assert.strictEqual(copyFileSyncCalls.length, 2);
    assert.ok(copyFileSyncCalls[0][0].endsWith("0"));
    assert.ok(copyFileSyncCalls[0][1].endsWith("audio.mp3"));
    assert.ok(copyFileSyncCalls[1][0].endsWith("1"));
    assert.ok(copyFileSyncCalls[1][1].endsWith("image.png"));
  });
});
