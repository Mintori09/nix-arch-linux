import test from 'node:test';
import assert from 'node:assert/strict';

import * as wysiwygModule from './app-wysiwyg.js';
import {
  getEditorContentForSaving,
  getWysiwygInitialContent,
  htmlToMarkdown,
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

test('getWysiwygInitialContent converts preview task lists into tiptap task list markup', () => {
  const html = getWysiwygInitialContent({
    markdown: '- [ ] todo\n- [x] done',
    renderedHTML:
      '<ul><li><input disabled="" type="checkbox"> todo</li><li><input checked="" disabled="" type="checkbox"> done</li></ul>',
  });

  assert.equal(
    html,
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>todo</p></div></li><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>done</p></div></li></ul>',
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

test('htmlToMarkdown preserves preview task list checkbox state', () => {
  const content = htmlToMarkdown(
    '<ul><li><input disabled="" type="checkbox"> todo</li><li><input checked="" disabled="" type="checkbox"> done</li></ul>',
  );

  assert.equal(content, '- [ ] todo\n\n- [x] done');
});

test('getEditorContentForSaving preserves tiptap task list checkbox state for autosave', () => {
  const content = getEditorContentForSaving({
    viewMode: 'wysiwyg',
    plainText: 'todo done',
    html:
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>todo</p></div></li><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>done</p></div></li></ul>',
  });

  assert.equal(content, '- [ ] todo\n\n- [x] done');
});

test('app-wysiwyg exports no vim helpers', () => {
  assert.equal('getVimIndicatorState' in wysiwygModule, false);
  assert.equal('getVimKeyAction' in wysiwygModule, false);
});
