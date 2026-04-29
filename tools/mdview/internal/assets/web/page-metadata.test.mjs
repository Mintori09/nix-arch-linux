import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDocumentTitle,
  formatPageTitle,
  syncPageTitle,
} from './page-metadata.js';

test('formatDocumentTitle appends the app name to the document name', () => {
  assert.equal(formatDocumentTitle('note.md'), 'note.md - mdview');
});

test('formatDocumentTitle falls back to mdview when name is empty', () => {
  assert.equal(formatDocumentTitle(''), 'mdview');
  assert.equal(formatDocumentTitle('   '), 'mdview');
});

test('formatPageTitle appends the app name to non-document page titles', () => {
  assert.equal(formatPageTitle('Share expired'), 'Share expired - mdview');
});

test('syncPageTitle writes the formatted title to a document-like object', () => {
  const mockDocument = { title: '' };

  syncPageTitle(mockDocument, 'note.md');
  assert.equal(mockDocument.title, 'note.md - mdview');

  syncPageTitle(mockDocument, '');
  assert.equal(mockDocument.title, 'mdview');
});
