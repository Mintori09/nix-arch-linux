import test from "node:test";
import assert from "node:assert/strict";

import {
  createOutlineRenderState,
  getOutlineHeadingElements,
  getOutlineScrollContainer,
  markOutlineDirty,
  shouldBuildOutline,
} from "./outline.js";

test("getOutlineHeadingElements reads headings from preview", () => {
  const previewHeadings = [{ id: "preview-heading" }];
  const previewElement = {
    querySelectorAll(selector) {
      assert.equal(selector, "h1, h2, h3, h4");
      return previewHeadings;
    },
  };
  const editorElement = {
    querySelectorAll() {
      throw new Error("editor should not be queried");
    },
  };

  const headings = getOutlineHeadingElements({
    previewElement,
    editorElement,
  });

  assert.deepEqual(headings, previewHeadings);
});

test("getOutlineScrollContainer uses the window scroll context", () => {
  const scrollContainer = getOutlineScrollContainer();

  assert.equal(scrollContainer, null);
});

test("outline stays dirty until sidebar opens", () => {
  const state = createOutlineRenderState();

  markOutlineDirty(state);

  assert.equal(shouldBuildOutline(state), false);
  assert.equal(state.dirty, true);
});

test("outline builds once after opening and clears dirty flag", () => {
  const state = createOutlineRenderState();
  markOutlineDirty(state);
  state.open = true;

  assert.equal(shouldBuildOutline(state), true);
  assert.equal(state.dirty, false);
  assert.equal(shouldBuildOutline(state), false);
});
