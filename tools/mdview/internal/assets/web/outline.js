const OUTLINE_HEADING_SELECTOR = "h1, h2, h3, h4";

export function getOutlineHeadingElements({ previewElement }) {
  return Array.from(previewElement?.querySelectorAll(OUTLINE_HEADING_SELECTOR) || []);
}

export function getOutlineScrollContainer() {
  return null;
}
