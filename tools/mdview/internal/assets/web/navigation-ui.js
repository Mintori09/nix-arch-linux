export function getSidebarToggleVisibility(workspaceFiles) {
  return (workspaceFiles || []).length >= 2;
}

export function shouldPollDocumentStatus(document) {
  return Boolean(document?.path) && !document?.temporary;
}

export function findPreviewSearchTarget({ blocks, excerpt, lineNumber }) {
  const candidates = [...(blocks || [])];
  const normalizedExcerpt = normalizeSearchText(excerpt);

  if (normalizedExcerpt) {
    const exactMatch = candidates.find((block) =>
      normalizeSearchText(block?.textContent).includes(normalizedExcerpt),
    );
    if (exactMatch) {
      return exactMatch;
    }
  }

  return candidates[Math.max(0, Math.min(candidates.length - 1, (lineNumber || 1) - 1))] || null;
}

export function getTopAlignedScrollY({ currentScrollY, targetTop, topOffset }) {
  return Math.max(0, Math.round(currentScrollY + targetTop - topOffset));
}

function normalizeSearchText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
