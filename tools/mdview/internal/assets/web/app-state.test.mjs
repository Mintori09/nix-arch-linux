import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyInitialUIState,
  createEmptyScrollSnapshots,
  getLayoutContext,
  getMobilePanelState,
  restoreScrollTargets,
  saveScrollSnapshot,
} from './app-state.js';

test('applyInitialUIState prefers query params over config defaults', () => {
  const state = applyInitialUIState({
    query: {
      mode: 'wysiwyg',
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
    viewMode: 'wysiwyg',
    sidebarOpen: false,
    outlineOpen: true,
  });
});

test('applyInitialUIState enables wysiwyg mode for empty temporary documents when no explicit mode is requested', () => {
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

  assert.equal(state.viewMode, 'wysiwyg');
});

test('applyInitialUIState preserves explicit wysiwyg mode', () => {
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

  assert.equal(state.viewMode, 'wysiwyg');
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

test('getLayoutContext distinguishes preview and wysiwyg layouts', () => {
  assert.equal(
    getLayoutContext({ viewMode: 'preview', isStacked: false }),
    'preview-only',
  );
  assert.equal(
    getLayoutContext({ viewMode: 'preview', isStacked: true }),
    'preview-only',
  );
  assert.equal(
    getLayoutContext({ viewMode: 'wysiwyg', isStacked: false }),
    'wysiwyg-only',
  );
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
    fromContext: 'wysiwyg-only',
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
    toContext: 'wysiwyg-only',
    snapshots,
    current: {
      pageMax: 200,
    },
  });

  assert.deepEqual(target, {
    pageY: 100,
  });
});

test('restoreScrollTargets keeps a dedicated snapshot for wysiwyg mode', () => {
  const snapshots = createEmptyScrollSnapshots();
  saveScrollSnapshot(snapshots, 'wysiwyg-only', {
    pageY: 90,
    pageMax: 300,
  });

  const target = restoreScrollTargets({
    fromContext: 'preview-only',
    toContext: 'wysiwyg-only',
    snapshots,
    current: {
      pageMax: 500,
    },
  });

  assert.deepEqual(target, {
    pageY: 90,
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
