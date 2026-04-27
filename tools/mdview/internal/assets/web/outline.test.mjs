import test from "node:test";
import assert from "node:assert/strict";

import {
  getOutlineHeadingElements,
  getOutlineScrollContainer,
} from "./outline.js";

test("getOutlineHeadingElements reads headings from preview in preview mode", () => {
  const previewHeadings = [{ id: "preview-heading" }];
  const previewElement = {
    querySelectorAll(selector) {
      assert.equal(selector, "h1, h2, h3, h4");
      return previewHeadings;
    },
  };
  const editorElement = {
    querySelectorAll() {
      throw new Error("editor should not be queried in preview mode");
    },
  };

  const headings = getOutlineHeadingElements({
    viewMode: "preview",
    previewElement,
    editorElement,
  });

  assert.deepEqual(headings, previewHeadings);
});

test("getOutlineHeadingElements reads headings from the WYSIWYG editor in wysiwyg mode", () => {
  const editorHeadings = [{ id: "editor-heading" }];
  const previewElement = {
    querySelectorAll() {
      throw new Error("preview should not be queried in wysiwyg mode");
    },
  };
  const editorElement = {
    querySelector(selector) {
      assert.equal(selector, ".ProseMirror");
      return {
        querySelectorAll(headingSelector) {
          assert.equal(headingSelector, "h1, h2, h3, h4");
          return editorHeadings;
        },
      };
    },
    querySelectorAll() {
      throw new Error("wysiwyg mode should query the ProseMirror surface");
    },
  };

  const headings = getOutlineHeadingElements({
    viewMode: "wysiwyg",
    previewElement,
    editorElement,
  });

  assert.deepEqual(headings, editorHeadings);
});

test("getOutlineScrollContainer uses the editor scroller in wysiwyg mode", () => {
  const editorElement = { id: "editor" };

  const scrollContainer = getOutlineScrollContainer({
    viewMode: "wysiwyg",
    editorElement,
  });

  assert.equal(scrollContainer, editorElement);
});

test("getOutlineScrollContainer uses the window scroll context in preview mode", () => {
  const scrollContainer = getOutlineScrollContainer({
    viewMode: "preview",
    editorElement: { id: "editor" },
  });

  assert.equal(scrollContainer, null);
});
