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
      mode: 'edit',
      sidebar: '0',
    },
    config: {
      default_edit_mode: false,
      default_sidebar_open: true,
      default_outline_open: true,
    },
    document: {
      temporary: false,
      content: '# note',
    },
  });

  assert.deepEqual(state, {
    editMode: true,
    sidebarOpen: false,
    outlineOpen: true,
  });
});

test('applyInitialUIState enables edit mode for empty temporary documents', () => {
  const state = applyInitialUIState({
    query: {},
    config: {
      default_edit_mode: false,
      default_sidebar_open: false,
      default_outline_open: false,
    },
    document: {
      temporary: true,
      content: '',
    },
  });

  assert.equal(state.editMode, true);
});

test('getLayoutContext distinguishes split desktop and split stacked layouts', () => {
  assert.equal(
    getLayoutContext({ editMode: true, isStacked: false }),
    'split-desktop',
  );
  assert.equal(
    getLayoutContext({ editMode: true, isStacked: true }),
    'split-stacked',
  );
  assert.equal(
    getLayoutContext({ editMode: false, isStacked: false }),
    'preview-only',
  );
});

test('saveScrollSnapshot stores exact values and normalized ratios by context', () => {
  const snapshots = createEmptyScrollSnapshots();

  saveScrollSnapshot(snapshots, 'split-desktop', {
    pageY: 320,
    pageMax: 800,
  });

  assert.deepEqual(snapshots['split-desktop'], {
    pageY: 320,
    pageRatio: 0.4,
  });
});

test('restoreScrollTargets reuses exact snapshot inside same context', () => {
  const snapshots = createEmptyScrollSnapshots();
  saveScrollSnapshot(snapshots, 'split-desktop', {
    pageY: 250,
    pageMax: 500,
  });

  const target = restoreScrollTargets({
    fromContext: 'preview-only',
    toContext: 'split-desktop',
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
  saveScrollSnapshot(snapshots, 'split-stacked', {
    pageY: 450,
    pageMax: 900,
  });

  const target = restoreScrollTargets({
    fromContext: 'split-stacked',
    toContext: 'split-desktop',
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
