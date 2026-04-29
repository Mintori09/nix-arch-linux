import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findPreviewSearchTarget,
  getSidebarToggleVisibility,
  getTopAlignedScrollY,
  shouldHandleWorkspaceArrowKey,
  shouldPollDocumentStatus,
} from './navigation-ui.js';

test('sidebar toggle is hidden until at least two workspace files are available', () => {
  assert.equal(getSidebarToggleVisibility([]), false);
  assert.equal(
    getSidebarToggleVisibility([{ path: 'a.md' }]),
    false,
  );
  assert.equal(
    getSidebarToggleVisibility([{ path: 'a.md' }, { path: 'b.md' }]),
    true,
  );
});

test('document polling is disabled for stdin and other temporary documents', () => {
  assert.equal(
    shouldPollDocumentStatus({
      name: 'stdin.md',
      temporary: true,
      path: '',
    }),
    false,
  );
  assert.equal(
    shouldPollDocumentStatus({
      name: 'Untitled',
      temporary: true,
      path: '',
    }),
    false,
  );
  assert.equal(
    shouldPollDocumentStatus({
      name: 'note.md',
      temporary: false,
      path: '/tmp/note.md',
    }),
    true,
  );
});

test('search navigation prefers a block containing the matched excerpt', () => {
  const blocks = [
    { textContent: 'Intro paragraph' },
    { textContent: 'Target line with   spaced text' },
    { textContent: 'Another block' },
  ];

  const target = findPreviewSearchTarget({
    blocks,
    excerpt: 'Target line with spaced text',
    lineNumber: 20,
  });

  assert.equal(target, blocks[1]);
});

test('search navigation falls back to approximate line block when excerpt is not found', () => {
  const blocks = [
    { textContent: 'One' },
    { textContent: 'Two' },
    { textContent: 'Three' },
  ];

  const target = findPreviewSearchTarget({
    blocks,
    excerpt: 'Missing excerpt',
    lineNumber: 2,
  });

  assert.equal(target, blocks[1]);
});

test('top-aligned scroll keeps the target near the top edge with offset', () => {
  assert.equal(
    getTopAlignedScrollY({
      currentScrollY: 300,
      targetTop: 220,
      topOffset: 80,
    }),
    440,
  );
  assert.equal(
    getTopAlignedScrollY({
      currentScrollY: 0,
      targetTop: 30,
      topOffset: 80,
    }),
    0,
  );
});

test('workspace arrow navigation accepts plain left and right keys on non-interactive targets', () => {
  assert.equal(
    shouldHandleWorkspaceArrowKey({
      appMode: 'admin',
      event: { key: 'ArrowLeft', repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: null },
      document: { path: '/workspace/docs/a.md', folder_root: '/workspace/docs', temporary: false },
      workspaceRoots: [{ path: '/workspace/docs' }],
    }),
    true,
  );

  assert.equal(
    shouldHandleWorkspaceArrowKey({
      appMode: 'admin',
      event: { key: 'ArrowRight', repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: { tagName: 'DIV', isContentEditable: false } },
      document: { path: '/workspace/docs/a.md', folder_root: '/workspace/docs', temporary: false },
      workspaceRoots: [{ path: '/workspace/docs' }],
    }),
    true,
  );
});

test('workspace arrow navigation rejects unsupported key events and inactive documents', () => {
  const base = {
    appMode: 'admin',
    document: { path: '/workspace/docs/a.md', folder_root: '/workspace/docs', temporary: false },
    workspaceRoots: [{ path: '/workspace/docs' }],
  };

  assert.equal(
    shouldHandleWorkspaceArrowKey({
      ...base,
      event: { key: 'ArrowUp', repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: null },
    }),
    false,
  );
  assert.equal(
    shouldHandleWorkspaceArrowKey({
      ...base,
      event: { key: 'ArrowLeft', repeat: true, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: null },
    }),
    false,
  );
  assert.equal(
    shouldHandleWorkspaceArrowKey({
      ...base,
      event: { key: 'ArrowRight', repeat: false, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, target: null },
    }),
    false,
  );
  assert.equal(
    shouldHandleWorkspaceArrowKey({
      ...base,
      appMode: 'public-share',
      event: { key: 'ArrowLeft', repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: null },
    }),
    false,
  );
  assert.equal(
    shouldHandleWorkspaceArrowKey({
      ...base,
      document: { path: '/outside/a.md', folder_root: '/outside', temporary: false },
      event: { key: 'ArrowLeft', repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: null },
    }),
    false,
  );
});

test('workspace arrow navigation rejects interactive event targets', () => {
  const base = {
    appMode: 'admin',
    document: { path: '/workspace/docs/a.md', folder_root: '/workspace/docs', temporary: false },
    workspaceRoots: [{ path: '/workspace/docs' }],
    event: { key: 'ArrowLeft', repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false },
  };

  assert.equal(
    shouldHandleWorkspaceArrowKey({
      ...base,
      event: { ...base.event, target: { tagName: 'INPUT', isContentEditable: false } },
    }),
    false,
  );
  assert.equal(
    shouldHandleWorkspaceArrowKey({
      ...base,
      event: { ...base.event, target: { tagName: 'TEXTAREA', isContentEditable: false } },
    }),
    false,
  );
  assert.equal(
    shouldHandleWorkspaceArrowKey({
      ...base,
      event: { ...base.event, target: { tagName: 'SELECT', isContentEditable: false } },
    }),
    false,
  );
  assert.equal(
    shouldHandleWorkspaceArrowKey({
      ...base,
      event: { ...base.event, target: { tagName: 'BUTTON', isContentEditable: false } },
    }),
    false,
  );
  assert.equal(
    shouldHandleWorkspaceArrowKey({
      ...base,
      event: { ...base.event, target: { tagName: 'DIV', isContentEditable: true } },
    }),
    false,
  );
});
