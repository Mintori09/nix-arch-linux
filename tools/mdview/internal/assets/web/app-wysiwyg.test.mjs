import test from 'node:test';
import assert from 'node:assert/strict';

import * as wysiwygModule from './app-wysiwyg.js';
import {
  getEditorContentForSaving,
  getWysiwygInitialContent,
} from './app-wysiwyg.js';

test('getWysiwygInitialContent prefers rendered preview HTML to preserve markdown structure', () => {
  const html = getWysiwygInitialContent({
    markdown: '# WYSIWYG Test\n\nThis is a seed paragraph.',
    renderedHTML: '<h1>WYSIWYG Test</h1><p>This is a seed paragraph.</p>',
  });

  assert.equal(
    html,
    '<h1>WYSIWYG Test</h1><p>This is a seed paragraph.</p>',
  );
});

test('getEditorContentForSaving keeps preview mode content unchanged', () => {
  const content = getEditorContentForSaving({
    viewMode: 'preview',
    plainText: '# WYSIWYG Test\n\nThis is a seed paragraph.',
  });

  assert.equal(content, '# WYSIWYG Test\n\nThis is a seed paragraph.');
});

test('getEditorContentForSaving converts WYSIWYG HTML back to markdown for autosave', () => {
  const content = getEditorContentForSaving({
    viewMode: 'wysiwyg',
    plainText: 'WYSIWYG Test This is a seed paragraph. Added from Playwright.',
    html: '<h1>WYSIWYG Test</h1><p>This is a seed paragraph. Added from Playwright.</p>',
  });

  assert.equal(
    content,
    '# WYSIWYG Test\n\nThis is a seed paragraph. Added from Playwright.',
  );
});

test('app-wysiwyg exports no vim helpers', () => {
  assert.equal('getVimIndicatorState' in wysiwygModule, false);
  assert.equal('getVimKeyAction' in wysiwygModule, false);
});
