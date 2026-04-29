export function getSidebarToggleVisibility(workspaceFiles) {
  return (workspaceFiles || []).length >= 2;
}

export function shouldPollDocumentStatus(document) {
  return Boolean(document?.path) && !document?.temporary;
}

export function shouldHandleWorkspaceArrowKey({ appMode, event, document, workspaceRoots }) {
  if (appMode !== 'admin') {
    return false;
  }
  if (!event || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
    return false;
  }
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
    return false;
  }
  if (!isWorkspaceDocument(document, workspaceRoots)) {
    return false;
  }
  return !isInteractiveEventTarget(event.target);
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

function isWorkspaceDocument(document, workspaceRoots) {
  if (!document?.path || !document?.folder_root || document.temporary) {
    return false;
  }

  const documentPath = normalizePath(document.path);
  const documentRoot = normalizePath(document.folder_root);
  if (!documentPath || !documentRoot || !documentPath.startsWith(`${documentRoot}/`)) {
    return false;
  }

  return (workspaceRoots || []).some((root) => normalizePath(root?.path) === documentRoot);
}

function isInteractiveEventTarget(target) {
  let node = target;
  while (node) {
    if (node.isContentEditable) {
      return true;
    }

    const tagName = String(node.tagName || '').toUpperCase();
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON') {
      return true;
    }
    if (typeof node.getAttribute === 'function') {
      const role = String(node.getAttribute('role') || '').toLowerCase();
      if (
        role === 'button' ||
        role === 'textbox' ||
        role === 'combobox' ||
        role === 'listbox' ||
        role === 'menuitem' ||
        role === 'option' ||
        role === 'slider' ||
        role === 'switch'
      ) {
        return true;
      }
    }

    node = node.parentElement || node.parentNode || null;
  }

  return false;
}

function normalizePath(path) {
  return String(path || '').replaceAll('\\', '/').replace(/\/$/, '');
}
