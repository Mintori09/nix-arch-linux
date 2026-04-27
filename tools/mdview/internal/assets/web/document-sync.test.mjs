import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDocumentSyncState,
  mergeDocumentVersions,
} from './document-sync.js';

test('getDocumentSyncState treats matching content as clean', () => {
  const syncState = getDocumentSyncState({
    lastSyncedContent: '# note\n',
    currentContent: '# note\n',
  });

  assert.equal(syncState.hasUnsavedLocalChanges, false);
});

test('getDocumentSyncState treats changed content as dirty', () => {
  const syncState = getDocumentSyncState({
    lastSyncedContent: '# note\n',
    currentContent: '# note\nupdated\n',
  });

  assert.equal(syncState.hasUnsavedLocalChanges, true);
});

test('mergeDocumentVersions auto-merges non-overlapping edits', () => {
  const result = mergeDocumentVersions({
    base: '# Title\n\nalpha\nbeta\ngamma',
    local: '# Title\n\nalpha\nbeta\ngamma\nlocal tail',
    remote: '# Title updated\n\nalpha\nbeta\ngamma',
  });

  assert.equal(result.status, 'merged');
  assert.equal(
    result.content,
    '# Title updated\n\nalpha\nbeta\ngamma\nlocal tail',
  );
});

test('mergeDocumentVersions flags overlapping edits as conflicts', () => {
  const result = mergeDocumentVersions({
    base: '# Title\n\nalpha',
    local: '# Title local\n\nalpha',
    remote: '# Title remote\n\nalpha',
  });

  assert.equal(result.status, 'conflict');
  assert.match(result.reason, /overlap/i);
});
