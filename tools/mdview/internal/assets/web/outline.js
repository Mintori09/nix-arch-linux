const OUTLINE_HEADING_SELECTOR = "h1, h2, h3, h4";

export function getOutlineHeadingElements({ previewElement }) {
  return Array.from(previewElement?.querySelectorAll(OUTLINE_HEADING_SELECTOR) || []);
}

export function getOutlineScrollContainer() {
  return null;
}

export function createOutlineRenderState() {
  return {
    open: false,
    dirty: false,
  };
}

export function markOutlineDirty(state) {
  state.dirty = true;
}

export function shouldBuildOutline(state) {
  if (!state.open || !state.dirty) {
    return false;
  }

  state.dirty = false;
  return true;
}
