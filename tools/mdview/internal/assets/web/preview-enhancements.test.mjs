import test from "node:test";
import assert from "node:assert/strict";

import {
  collectPreviewCodeBlocks,
  previewNeedsMermaid,
} from "./preview-enhancements.js";

function createPreBlock({ className = "", text = "", preClassList = [] } = {}) {
  const code = {
    className,
    textContent: text,
  };

  return {
    classList: {
      contains(value) {
        return preClassList.includes(value);
      },
    },
    querySelector(selector) {
      assert.equal(selector, "code");
      return code;
    },
  };
}

test("previewNeedsMermaid stays false for non-mermaid code fences", () => {
  const previewElement = {
    querySelectorAll(selector) {
      assert.equal(selector, "pre");
      return [
        createPreBlock({ className: "language-go", text: "package main" }),
        createPreBlock({ className: "language-js", text: "console.log(1)" }),
      ];
    },
  };

  assert.equal(previewNeedsMermaid(previewElement), false);
});

test("previewNeedsMermaid detects mermaid fences", () => {
  const previewElement = {
    querySelectorAll() {
      return [
        createPreBlock({ className: "language-mermaid", text: "graph TD;A-->B;" }),
      ];
    },
  };

  assert.equal(previewNeedsMermaid(previewElement), true);
});

test("collectPreviewCodeBlocks finds mermaid and copy candidates in one pass", () => {
  const mermaidPre = createPreBlock({
    className: "language-mermaid",
    text: "graph TD;A-->B;",
  });
  const goPre = createPreBlock({
    className: "language-go",
    text: "package main",
  });

  const previewElement = {
    querySelectorAll() {
      return [mermaidPre, goPre];
    },
  };

  const result = collectPreviewCodeBlocks(previewElement);

  assert.deepEqual(result.copyable.map((entry) => entry.pre), [mermaidPre, goPre]);
  assert.deepEqual(result.mermaid.map((entry) => entry.pre), [mermaidPre]);
});
