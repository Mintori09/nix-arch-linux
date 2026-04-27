import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWorkspaceTree, isActiveWorkspaceFile } from './workspace-tree.js';

test('buildWorkspaceTree nests directories and keeps folders before files', () => {
  const tree = buildWorkspaceTree([
    {
      path: '/workspace/docs',
      name: 'docs',
      entries: [
        { path: 'guides/', name: 'guides', type: 'directory' },
        { path: 'guides/setup/', name: 'setup', type: 'directory' },
        { path: 'overview.md', name: 'overview.md', type: 'file' },
        { path: 'guides/setup/install.md', name: 'install.md', type: 'file' },
      ],
    },
  ]);

  assert.equal(tree.length, 1);
  assert.equal(tree[0].type, 'root');
  assert.equal(tree[0].children[0].type, 'directory');
  assert.equal(tree[0].children[1].type, 'file');
  assert.equal(tree[0].children[0].children[0].path, 'guides/setup/');
  assert.equal(tree[0].children[0].children[0].children[0].path, 'guides/setup/install.md');
});

test('buildWorkspaceTree keeps roots separate when relative file paths overlap', () => {
  const tree = buildWorkspaceTree([
    {
      path: '/workspace/a',
      name: 'a',
      entries: [{ path: 'shared.md', name: 'shared.md', type: 'file' }],
    },
    {
      path: '/workspace/b',
      name: 'b',
      entries: [{ path: 'shared.md', name: 'shared.md', type: 'file' }],
    },
  ]);

  assert.equal(tree.length, 2);
  assert.equal(tree[0].children[0].rootPath, '/workspace/a');
  assert.equal(tree[1].children[0].rootPath, '/workspace/b');
});

test('isActiveWorkspaceFile matches the open file inside the active workspace root', () => {
  assert.equal(
    isActiveWorkspaceFile(
      {
        type: 'file',
        path: 'guides/setup.md',
        rootPath: '/workspace/docs',
      },
      {
        path: '/workspace/docs/guides/setup.md',
        folder_root: '/workspace/docs',
        temporary: false,
      },
    ),
    true,
  );

  assert.equal(
    isActiveWorkspaceFile(
      {
        type: 'file',
        path: 'guides/setup.md',
        rootPath: '/workspace/other',
      },
      {
        path: '/workspace/docs/guides/setup.md',
        folder_root: '/workspace/docs',
        temporary: false,
      },
    ),
    false,
  );
});

test('isActiveWorkspaceFile ignores temporary documents and files outside the workspace tree', () => {
  assert.equal(
    isActiveWorkspaceFile(
      {
        type: 'file',
        path: 'draft.md',
        rootPath: '/workspace/docs',
      },
      {
        path: '/workspace/docs/draft.md',
        folder_root: '/workspace/docs',
        temporary: true,
      },
    ),
    false,
  );

  assert.equal(
    isActiveWorkspaceFile(
      {
        type: 'file',
        path: 'draft.md',
        rootPath: '/workspace/docs',
      },
      {
        path: '/outside/docs/draft.md',
        folder_root: '/outside/docs',
        temporary: false,
      },
    ),
    false,
  );
});
