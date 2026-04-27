import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getReaderPopupVisibility,
  getDefaultSettingsTab,
  getGoogleVoicesForLanguage,
  mapBrowserVoices,
} from './reader-ui.js';

test('reader popup is visible while playback is active or paused', () => {
  assert.equal(getReaderPopupVisibility('idle'), false);
  assert.equal(getReaderPopupVisibility('playing'), true);
  assert.equal(getReaderPopupVisibility('paused'), true);
  assert.equal(getReaderPopupVisibility('loading'), true);
  assert.equal(getReaderPopupVisibility('stopped'), false);
});

test('default settings tab is theme', () => {
  assert.equal(getDefaultSettingsTab(), 'theme');
});

test('google voices returns curated Vietnamese voices', () => {
  const voices = getGoogleVoicesForLanguage('vi-VN');

  assert.equal(voices.length > 0, true);
  assert.equal(voices.some((voice) => voice.name === 'vi-VN-Wavenet-A'), true);
  assert.equal(voices.some((voice) => voice.name === 'vi-VN-Neural2-A'), true);
});

test('mapBrowserVoices filters by language prefix and maps fields', () => {
  const fakeVoices = [
    { name: 'Alice', lang: 'vi-VN' },
    { name: 'Bob', lang: 'en-US' },
    { name: 'Charlie', lang: 'vi-VN-x-southern' },
  ];

  const result = mapBrowserVoices(fakeVoices, 'vi-VN');

  assert.equal(result.length, 2);
  assert.equal(result[0].name, 'Alice');
  assert.equal(result[0].label, 'Alice');
  assert.equal(result[0].language, 'vi-VN');
  assert.equal(result[0].tier, 'browser');
  assert.equal(result[1].name, 'Charlie');
});
