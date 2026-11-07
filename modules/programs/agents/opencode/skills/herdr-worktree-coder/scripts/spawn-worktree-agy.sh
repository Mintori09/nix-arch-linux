#!/usr/bin/env bash
set -euo pipefail

# Fail-fast one-pass prerequisite check
for cmd in git agy herdr jq; do
  command -v "$cmd" >/dev/null 2>&1 || { echo >&2 "[ERROR] '$cmd' is required but not installed."; exit 1; }
done
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo >&2 "[ERROR] Must run inside a Git repository."; exit 1; }

# Parse arguments
TASK_NAME="${1:-}"
BRIEF_FILE="${2:-.task-brief.local.md}"

if [ -z "$TASK_NAME" ]; then
  TASK_NAME="fix-$(date +%s)"
fi

if [ ! -f "$BRIEF_FILE" ]; then
  echo >&2 "[ERROR] Brief file '$BRIEF_FILE' not found."
  exit 1
fi

SLUG="wt-${TASK_NAME}"
BRANCH="wt/${TASK_NAME}"
WORKTREE_PATH=".worktrees/${TASK_NAME}"
AGENT_NAME="agy-${TASK_NAME}"

# 1. Create worktree in Herdr (non-blocking, no-focus)
WT_OUTPUT=$(herdr worktree create \
  --branch "${BRANCH}" \
  --path "${WORKTREE_PATH}" \
  --label "WT: ${TASK_NAME}" \
  --no-focus \
  --trust-repository)

# Extract new workspace ID
NEW_WS_ID=$(echo "$WT_OUTPUT" | jq -r '.result.open_workspace_id // empty')
if [ -z "$NEW_WS_ID" ]; then
  # Fallback: query from worktree list
  NEW_WS_ID=$(herdr worktree list --json | jq -r --arg p "$(realpath "$WORKTREE_PATH")" '.result.worktrees[] | select(.path == $p) | .open_workspace_id // empty')
fi

# 2. Copy context brief into worktree
cp "$BRIEF_FILE" "${WORKTREE_PATH}/.task-brief.local.md"

# 3. Discover pane ID in new workspace
PANE_ID=""
if [ -n "$NEW_WS_ID" ]; then
  PANE_ID=$(herdr pane list --workspace "$NEW_WS_ID" | jq -r '.result.panes[0].pane_id // empty')
fi

# 4. Start interactive agy agent
if [ -n "$PANE_ID" ]; then
  herdr agent start "${AGENT_NAME}" --kind agy --pane "${PANE_ID}" >/dev/null
  
  # 5. Submit initial prompt to agent
  herdr agent prompt "${AGENT_NAME}" \
    "Vui lòng đọc kỹ .task-brief.local.md. Hãy viết test tái hiện vấn đề/yêu cầu, thực hiện sửa đổi code, chạy bộ test kiểm tra pass 100%, và báo cáo tóm tắt khi hoàn thành." >/dev/null
fi

# Output JSON summary for caller agent
cat <<EOF
{
  "task_name": "${TASK_NAME}",
  "branch": "${BRANCH}",
  "worktree_path": "${WORKTREE_PATH}",
  "workspace_id": "${NEW_WS_ID}",
  "pane_id": "${PANE_ID}",
  "agent_name": "${AGENT_NAME}",
  "status": "spawned"
}
EOF
