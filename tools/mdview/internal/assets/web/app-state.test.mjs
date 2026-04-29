import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyInitialUIState,
  createEmptyScrollSnapshots,
  getAppMode,
  getLayoutContext,
  getMobilePanelState,
  getShareButtonState,
  restoreScrollTargets,
  saveScrollSnapshot,
} from './app-state.js';

test('applyInitialUIState prefers query params over config defaults', () => {
  const state = applyInitialUIState({
    query: {
      mode: 'preview',
      sidebar: '0',
    },
    config: {
      default_sidebar_open: true,
      default_outline_open: true,
    },
    document: {
      temporary: false,
      content: '# note',
    },
  });

  assert.deepEqual(state, {
    viewMode: 'preview',
    sidebarOpen: false,
    outlineOpen: true,
  });
});

test('applyInitialUIState keeps empty temporary documents in preview mode', () => {
  const state = applyInitialUIState({
    query: {},
    config: {
      default_sidebar_open: false,
      default_outline_open: false,
    },
    document: {
      temporary: true,
      content: '',
    },
  });

  assert.equal(state.viewMode, 'preview');
});

test('applyInitialUIState ignores explicit wysiwyg mode', () => {
  const state = applyInitialUIState({
    query: {
      mode: 'wysiwyg',
    },
    config: {
      default_sidebar_open: false,
      default_outline_open: false,
    },
    document: {
      temporary: false,
      content: '# note',
    },
  });

  assert.equal(state.viewMode, 'preview');
});

test('applyInitialUIState falls back to preview for unsupported modes', () => {
  const state = applyInitialUIState({
    query: {
      mode: 'edit',
    },
    config: {
      default_sidebar_open: false,
      default_outline_open: false,
    },
    document: {
      temporary: false,
      content: '# note',
    },
  });

  assert.equal(state.viewMode, 'preview');
});

test('getAppMode treats share bootstrap as public-share mode', () => {
  assert.equal(getAppMode({ mode: 'public-share' }), 'public-share');
  assert.equal(getAppMode({ mode: 'unknown' }), 'admin');
});

test('getShareButtonState maps share lifecycle to button labels', () => {
  assert.deepEqual(
    getShareButtonState({ status: 'idle', disabledReason: '' }),
    { label: 'Share', disabled: false, error: '' },
  );
  assert.deepEqual(
    getShareButtonState({ status: 'starting', disabledReason: '' }),
    { label: 'Starting...', disabled: true, error: '' },
  );
  assert.deepEqual(
    getShareButtonState({ status: 'active', disabledReason: '' }),
    { label: 'Stop sharing', disabled: false, error: '' },
  );
  assert.deepEqual(
    getShareButtonState({ status: 'error', disabledReason: 'share unavailable', error: 'cloudflared failed' }),
    { label: 'Share', disabled: true, error: 'cloudflared failed' },
  );
});

test('getLayoutContext always returns the preview layout', () => {
  assert.equal(
    getLayoutContext({ viewMode: 'preview', isStacked: false }),
    'preview-only',
  );
  assert.equal(
    getLayoutContext({ viewMode: 'preview', isStacked: true }),
    'preview-only',
  );
  assert.equal(getLayoutContext({ viewMode: 'wysiwyg', isStacked: false }), 'preview-only');
});

test('saveScrollSnapshot stores exact values and normalized ratios by context', () => {
  const snapshots = createEmptyScrollSnapshots();

  saveScrollSnapshot(snapshots, 'preview-only', {
    pageY: 320,
    pageMax: 800,
  });

  assert.deepEqual(snapshots['preview-only'], {
    pageY: 320,
    pageRatio: 0.4,
  });
});

test('restoreScrollTargets reuses exact snapshot inside same context', () => {
  const snapshots = createEmptyScrollSnapshots();
  saveScrollSnapshot(snapshots, 'preview-only', {
    pageY: 250,
    pageMax: 500,
  });

  const target = restoreScrollTargets({
    fromContext: 'preview-only',
    toContext: 'preview-only',
    snapshots,
    current: {
      pageMax: 700,
    },
  });

  assert.deepEqual(target, {
    pageY: 250,
  });
});

test('restoreScrollTargets maps page scroll by ratio when entering a new context', () => {
  const snapshots = createEmptyScrollSnapshots();
  saveScrollSnapshot(snapshots, 'preview-only', {
    pageY: 450,
    pageMax: 900,
  });

  const target = restoreScrollTargets({
    fromContext: 'preview-only',
    toContext: 'unknown',
    snapshots,
    current: {
      pageMax: 200,
    },
  });

  assert.deepEqual(target, {
    pageY: 100,
  });
});

test('getMobilePanelState keeps only one panel open on mobile', () => {
  assert.deepEqual(
    getMobilePanelState({
      isMobile: true,
      filesAvailable: true,
      toggle: 'sidebar',
      current: { sidebarOpen: false, outlineOpen: true },
    }),
    { sidebarOpen: true, outlineOpen: false },
  );

  assert.deepEqual(
    getMobilePanelState({
      isMobile: true,
      filesAvailable: true,
      toggle: null,
      current: { sidebarOpen: true, outlineOpen: true },
    }),
    { sidebarOpen: true, outlineOpen: true },
  );
});
