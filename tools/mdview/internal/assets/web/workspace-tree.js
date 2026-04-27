export function buildWorkspaceTree(roots) {
  return (roots || []).map((root) => ({
    type: 'root',
    path: root.path,
    name: root.name,
    rootPath: root.path,
    children: buildChildren(root),
  }));
}

export function flattenWorkspaceFiles(roots) {
  const files = [];
  for (const root of buildWorkspaceTree(roots)) {
    walkFiles(root.children, files);
  }
  return files;
}

export function findAdjacentWorkspaceFile(roots, current, direction) {
  const files = flattenWorkspaceFiles(roots);
  const index = files.findIndex(
    (file) => file.rootPath === current.rootPath && file.path === current.path,
  );
  if (index === -1) {
    return null;
  }
  const delta = direction === 'prev' ? -1 : 1;
  return files[index + delta] || null;
}

export function isActiveWorkspaceFile(node, document) {
  if (!node || node.type !== 'file' || !document || document.temporary) {
    return false;
  }

  const documentRoot = normalizePath(document.folder_root);
  const nodeRoot = normalizePath(node.rootPath);
  if (!documentRoot || !nodeRoot || documentRoot !== nodeRoot) {
    return false;
  }

  return joinPath(nodeRoot, node.path) === normalizePath(document.path);
}

function buildChildren(root) {
  const nodes = new Map();
  const children = [];
  const entries = (root.entries || []).slice().sort(compareEntries);

  for (const entry of entries) {
    const node = {
      ...entry,
      rootPath: root.path,
      children: entry.type === 'directory' ? [] : undefined,
    };
    nodes.set(entry.path, node);

    const parentPath = parentDirectory(entry.path);
    if (!parentPath) {
      children.push(node);
      continue;
    }

    const parent = nodes.get(parentPath);
    if (parent?.children) {
      parent.children.push(node);
    } else {
      children.push(node);
    }
  }

  sortTree(children);
  return children;
}

function walkFiles(nodes, files) {
  for (const node of nodes || []) {
    if (node.type === 'file') {
      files.push(node);
      continue;
    }
    walkFiles(node.children, files);
  }
}

function sortTree(nodes) {
  nodes.sort(compareEntries);
  for (const node of nodes) {
    if (node.children) {
      sortTree(node.children);
    }
  }
}

function compareEntries(left, right) {
  if (left.type !== right.type) {
    return left.type === 'directory' ? -1 : 1;
  }
  return left.path.localeCompare(right.path);
}

function parentDirectory(path) {
  const clean = String(path || '').replace(/\/$/, '');
  const index = clean.lastIndexOf('/');
  if (index === -1) {
    return '';
  }
  return `${clean.slice(0, index + 1)}`;
}

function normalizePath(path) {
  return String(path || '').replaceAll('\\', '/').replace(/\/$/, '');
}

function joinPath(rootPath, relativePath) {
  const root = normalizePath(rootPath);
  const relative = String(relativePath || '').replaceAll('\\', '/').replace(/^\/+/, '');
  if (!root) {
    return relative;
  }
  if (!relative) {
    return root;
  }
  return `${root}/${relative}`;
}
