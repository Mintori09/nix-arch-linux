import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  loadDefaults,
  loadStyleConfig,
  resolveAlias,
  resolveStylePath,
} from "./config.ts";

describe("loadStyleConfig", () => {
  it("returns empty map when config file missing", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "cv-cfg-"));
    try {
      const cfg = loadStyleConfig(tmp);
      assert.deepStrictEqual(cfg, {});
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("loads styles from config.json", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "cv-cfg-"));
    try {
      writeFileSync(
        path.join(tmp, "config.json"),
        JSON.stringify({
          styles: {
            blog: "/home/user/blog.css",
            dark: "/home/user/dark.css",
          },
        }),
      );
      const cfg = loadStyleConfig(tmp);
      assert.strictEqual(cfg.blog, "/home/user/blog.css");
      assert.strictEqual(cfg.dark, "/home/user/dark.css");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("ignores non-object styles key", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "cv-cfg-"));
    try {
      writeFileSync(
        path.join(tmp, "config.json"),
        JSON.stringify({ styles: "invalid" }),
      );
      const cfg = loadStyleConfig(tmp);
      assert.deepStrictEqual(cfg, {});
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns empty map for non-existent custom path", () => {
    const result = loadStyleConfig("/nonexistent/path");
    assert.deepStrictEqual(result, {});
  });
});

describe("resolveAlias", () => {
  it("returns absolute path when style matches an alias", () => {
    const aliases = { blog: "/home/user/blog.css" };
    assert.strictEqual(resolveAlias("blog", aliases), "/home/user/blog.css");
  });

  it("returns null when style does not match any alias", () => {
    const aliases = { blog: "/home/user/blog.css" };
    assert.strictEqual(resolveAlias("nope", aliases), null);
  });

  it("returns null when aliases is empty", () => {
    assert.strictEqual(resolveAlias("blog", {}), null);
  });
});

describe("resolveStylePath (simplified)", () => {
  it("returns absolute path if file exists", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "cv-cfg-"));
    try {
      const cssPath = path.join(tmp, "theme.css");
      writeFileSync(cssPath, "body {}");
      const result = resolveStylePath(cssPath);
      assert.strictEqual(result, cssPath);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("resolves relative to CWD if file exists", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "cv-cfg-"));
    const origCwd = process.cwd();
    try {
      const cssPath = "test-fixture.css";
      writeFileSync(path.join(tmp, cssPath), "body {}");
      process.chdir(tmp);
      const result = resolveStylePath(cssPath);
      assert.strictEqual(result, path.resolve(tmp, cssPath));
    } finally {
      process.chdir(origCwd);
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns null when file doesn't exist", () => {
    assert.strictEqual(resolveStylePath("/nonexistent/file.css"), null);
  });

  it("expands tilde to homedir if file exists", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "cv-cfg-"));
    try {
      const cssPath = path.join(tmp, "tilde.css");
      writeFileSync(cssPath, "body {}");
      // Find homedir-relative path: replace homedir with ~
      const home = process.env.HOME!;
      if (cssPath.startsWith(home)) {
        const tildePath = cssPath.replace(home, "~");
        const result = resolveStylePath(tildePath);
        assert.strictEqual(result, cssPath);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("loadDefaults", () => {
  it("returns empty object when no config file exists", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "cv-cfg-"));
    try {
      const result = loadDefaults("unknown:route", tmp);
      assert.deepStrictEqual(result, {});
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns empty object for unknown route with no builtin", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "cv-cfg-"));
    try {
      writeFileSync(
        path.join(tmp, "config.json"),
        JSON.stringify({
          defaults: { "md:pdf": { pageSize: "a4" } },
        }),
      );
      const result = loadDefaults("unknown:route", tmp);
      assert.deepStrictEqual(result, {});
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("config.json overrides built-in defaults", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "cv-cfg-"));
    try {
      writeFileSync(
        path.join(tmp, "config.json"),
        JSON.stringify({
          defaults: { "md:pdf": { pageSize: "letter", toc: true } },
        }),
      );
      const result = loadDefaults("md:pdf", tmp);
      assert.strictEqual(result.pageSize, "letter");
      assert.strictEqual(result.toc, true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("resolves tilde in css path to style", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "cv-cfg-"));
    try {
      const cssDir = path.join(tmp, "styles");
      mkdirSync(cssDir, { recursive: true });
      const cssPath = path.join(cssDir, "pdf.css");
      writeFileSync(cssPath, "body {}");
      const home = process.env.HOME!;
      const tildePath = cssPath.replace(home, "~");
      writeFileSync(
        path.join(tmp, "config.json"),
        JSON.stringify({
          defaults: { "md:pdf": { css: tildePath } },
        }),
      );
      const result = loadDefaults("md:pdf", tmp);
      assert.strictEqual(result.style, cssPath);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns only defaults for the matching route", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "cv-cfg-"));
    try {
      writeFileSync(
        path.join(tmp, "config.json"),
        JSON.stringify({
          defaults: {
            "md:pdf": { pageSize: "a4" },
            "md:html": { toc: true },
          },
        }),
      );
      const result = loadDefaults("md:html", tmp);
      assert.strictEqual(result.toc, true);
      assert.strictEqual(result.pageSize, undefined);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("handles built-in defaults without config file", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "cv-cfg-"));
    try {
      writeFileSync(path.join(tmp, "config.json"), JSON.stringify({}));
      const result = loadDefaults("md:pdf", tmp);
      assert.strictEqual(result.pageSize, "a4");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("ignores non-object defaults key", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "cv-cfg-"));
    try {
      writeFileSync(
        path.join(tmp, "config.json"),
        JSON.stringify({ defaults: "invalid" }),
      );
      const result = loadDefaults("md:pdf", tmp);
      assert.strictEqual(result.pageSize, "a4");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
