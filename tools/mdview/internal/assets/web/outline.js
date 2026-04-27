const OUTLINE_HEADING_SELECTOR = "h1, h2, h3, h4";

export function getOutlineHeadingElements({
  viewMode,
  previewElement,
  editorElement,
}) {
  if (viewMode === "wysiwyg") {
    const proseMirrorRoot = editorElement?.querySelector(".ProseMirror");
    if (proseMirrorRoot) {
      return Array.from(proseMirrorRoot.querySelectorAll(OUTLINE_HEADING_SELECTOR));
    }
  }

  return Array.from(previewElement?.querySelectorAll(OUTLINE_HEADING_SELECTOR) || []);
}

export function getOutlineScrollContainer({
  viewMode,
  editorElement,
}) {
  if (viewMode === "wysiwyg" && editorElement) {
    return editorElement;
  }

  return null;
}
