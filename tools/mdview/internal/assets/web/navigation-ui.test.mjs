import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findPreviewSearchTarget,
  getSidebarToggleVisibility,
  getTopAlignedScrollY,
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
