import test from 'node:test';
import assert from 'node:assert/strict';

import { toSpeechText } from './speech.js';

test('toSpeechText strips obvious markdown control syntax', () => {
  const text = toSpeechText(`# Story\n\n[Read more](chapter-2.md)\n\n- Item\n\n\`\`\`js\nconst a = 1;\n\`\`\``);

  assert.equal(text.includes('#'), false);
  assert.equal(text.includes('chapter-2.md'), false);
  assert.equal(text.includes('```'), false);
});
