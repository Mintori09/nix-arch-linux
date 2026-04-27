export function getDocumentSyncState({ lastSyncedContent, currentContent }) {
  return {
    hasUnsavedLocalChanges: (currentContent || "") !== (lastSyncedContent || ""),
  };
}

export function mergeDocumentVersions({ base, local, remote }) {
  if ((local || "") === (remote || "")) {
    return { status: "unchanged", content: local || "" };
  }

  const localChanges = buildChanges(splitLines(base), splitLines(local));
  const remoteChanges = buildChanges(splitLines(base), splitLines(remote));
  const localHasChanges = localChanges.length > 0;
  const remoteHasChanges = remoteChanges.length > 0;

  if (!localHasChanges) {
    return { status: "remote", content: remote || "" };
  }
  if (!remoteHasChanges) {
    return { status: "local", content: local || "" };
  }

  for (const localChange of localChanges) {
    for (const remoteChange of remoteChanges) {
      if (rangesOverlap(localChange, remoteChange)) {
        if (sameReplacement(localChange.lines, remoteChange.lines)) {
          continue;
        }
        return {
          status: "conflict",
          reason: "Detected overlapping local and external edits.",
        };
      }
    }
  }

  const merged = applyChanges(splitLines(base), [...localChanges, ...remoteChanges]);
  return {
    status: "merged",
    content: joinLines(merged),
  };
}

function splitLines(value) {
  if (!value) {
    return [];
  }
  return value.split("\n");
}

function joinLines(lines) {
  return lines.join("\n");
}

function sameReplacement(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function rangesOverlap(left, right) {
  if (left.start === left.end && right.start === right.end) {
    return left.start === right.start;
  }
  return left.start < right.end && right.start < left.end;
}

function applyChanges(baseLines, changes) {
  const merged = [];
  const ordered = changes
    .slice()
    .sort((a, b) => a.start - b.start || a.end - b.end);
  let cursor = 0;

  for (const change of ordered) {
    merged.push(...baseLines.slice(cursor, change.start));
    merged.push(...change.lines);
    cursor = change.end;
  }

  merged.push(...baseLines.slice(cursor));
  return merged;
}

function buildChanges(baseLines, targetLines) {
  const operations = diffLines(baseLines, targetLines);
  const changes = [];
  let baseIndex = 0;
  let current = null;

  for (const operation of operations) {
    if (operation.type === "equal") {
      if (current) {
        changes.push(current);
        current = null;
      }
      baseIndex += 1;
      continue;
    }

    if (!current) {
      current = { start: baseIndex, end: baseIndex, lines: [] };
    }

    if (operation.type === "delete") {
      current.end += 1;
      baseIndex += 1;
      continue;
    }

    current.lines.push(operation.value);
  }

  if (current) {
    changes.push(current);
  }

  return changes;
}

function diffLines(baseLines, targetLines) {
  const rows = baseLines.length;
  const cols = targetLines.length;
  const lcs = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(0));

  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let col = cols - 1; col >= 0; col -= 1) {
      if (baseLines[row] === targetLines[col]) {
        lcs[row][col] = lcs[row + 1][col + 1] + 1;
      } else {
        lcs[row][col] = Math.max(lcs[row + 1][col], lcs[row][col + 1]);
      }
    }
  }

  const operations = [];
  let row = 0;
  let col = 0;

  while (row < rows && col < cols) {
    if (baseLines[row] === targetLines[col]) {
      operations.push({ type: "equal", value: baseLines[row] });
      row += 1;
      col += 1;
      continue;
    }

    if (lcs[row + 1][col] >= lcs[row][col + 1]) {
      operations.push({ type: "delete", value: baseLines[row] });
      row += 1;
      continue;
    }

    operations.push({ type: "insert", value: targetLines[col] });
    col += 1;
  }

  while (row < rows) {
    operations.push({ type: "delete", value: baseLines[row] });
    row += 1;
  }

  while (col < cols) {
    operations.push({ type: "insert", value: targetLines[col] });
    col += 1;
  }

  return operations;
}
