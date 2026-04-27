import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEditorContentForSaving,
  getVimIndicatorState,
  getVimKeyAction,
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

test('getEditorContentForSaving keeps plain edit mode content unchanged', () => {
  const content = getEditorContentForSaving({
    viewMode: 'edit',
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

test('getVimIndicatorState shows a visual mode chip only in wysiwyg mode', () => {
  assert.deepEqual(
    getVimIndicatorState({ viewMode: 'wysiwyg', vimMode: 'visual' }),
    {
      hidden: false,
      text: 'VISUAL',
      tone: 'visual',
    },
  );

  assert.deepEqual(
    getVimIndicatorState({ viewMode: 'edit', vimMode: 'visual' }),
    {
      hidden: true,
      text: '',
      tone: '',
    },
  );
});

test('getVimKeyAction enters visual mode from normal mode and exits with escape', () => {
  assert.deepEqual(
    getVimKeyAction({ vimMode: 'normal', key: 'v', isCtrl: false }),
    {
      type: 'set-mode',
      mode: 'visual',
    },
  );

  assert.deepEqual(
    getVimKeyAction({ vimMode: 'visual', key: 'Escape', isCtrl: false }),
    {
      type: 'set-mode',
      mode: 'normal',
      collapseSelection: true,
    },
  );
});

test('getVimKeyAction extends selection in visual mode with horizontal motions', () => {
  assert.deepEqual(
    getVimKeyAction({ vimMode: 'visual', key: 'h', isCtrl: false }),
    {
      type: 'command',
      command: 'moveCursorBackward',
      extend: true,
    },
  );

  assert.deepEqual(
    getVimKeyAction({ vimMode: 'visual', key: '$', isCtrl: false }),
    {
      type: 'command',
      command: 'moveCursorToEndOfLine',
      extend: true,
    },
  );
});
