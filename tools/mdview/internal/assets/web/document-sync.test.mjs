import test from 'node:test';
import assert from 'node:assert/strict';

import { getDocumentStatusAction } from './document-sync.js';

test('getDocumentStatusAction ignores untracked and unchanged statuses', () => {
  assert.equal(getDocumentStatusAction({
    status: { tracked: false, changed: true, revision_id: 'rev-2' },
    lastSyncedRevision: 'rev-1',
    acknowledgedRemoteRevision: '',
    isDirty: false,
  }), 'ignore');

  assert.equal(getDocumentStatusAction({
    status: { tracked: true, changed: false, revision_id: 'rev-2' },
    lastSyncedRevision: 'rev-1',
    acknowledgedRemoteRevision: '',
    isDirty: false,
  }), 'ignore');
});

test('getDocumentStatusAction requests reload for clean remote changes', () => {
  assert.equal(getDocumentStatusAction({
    status: { tracked: true, changed: true, revision_id: 'rev-2' },
    lastSyncedRevision: 'rev-1',
    acknowledgedRemoteRevision: '',
    isDirty: false,
  }), 'reload');
});

test('getDocumentStatusAction requests conflict for dirty local state', () => {
  assert.equal(getDocumentStatusAction({
    status: { tracked: true, changed: true, revision_id: 'rev-2' },
    lastSyncedRevision: 'rev-1',
    acknowledgedRemoteRevision: '',
    isDirty: true,
  }), 'conflict');
});

test('getDocumentStatusAction ignores already-synced or acknowledged revisions', () => {
  assert.equal(getDocumentStatusAction({
    status: { tracked: true, changed: true, revision_id: 'rev-1' },
    lastSyncedRevision: 'rev-1',
    acknowledgedRemoteRevision: '',
    isDirty: false,
  }), 'ignore');

  assert.equal(getDocumentStatusAction({
    status: { tracked: true, changed: true, revision_id: 'rev-3' },
    lastSyncedRevision: 'rev-1',
    acknowledgedRemoteRevision: 'rev-3',
    isDirty: false,
  }), 'ignore');
});
