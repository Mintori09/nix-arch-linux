#!/usr/bin/env bash
set -euo pipefail

# Fail-fast one-pass prerequisite check
for cmd in git agy herdr jq; do
  command -v "$cmd" >/dev/null 2>&1 || { echo >&2 "[ERROR] '$cmd' is required but not installed."; exit 1; }
done
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo >&2 "[ERROR] Must run inside a Git repository."; exit 1; }

ACTION="${1:-all}"
TASK_PREFIX="${2:-fix}"

# Generate concurrency-safe unique slug if not provided as exact slug
generate_slug() {
  local prefix="${1:-fix}"
  local rand_hex
  rand_hex=$(head -c 2 /dev/urandom 2>/dev/null | od -An -tx1 | tr -d ' \n' || date +%N | cut -c1-4)
  echo "${prefix}-$(date +%s)-${rand_hex}"
}

case "$ACTION" in
  init)
    # Stage 1: Provision isolated worktree & workspace
    TASK_SLUG=$(generate_slug "$TASK_PREFIX")
    BRANCH="wt/${TASK_SLUG}"
    WORKTREE_PATH=".worktrees/${TASK_SLUG}"
    AGENT_NAME="agy-${TASK_SLUG}"

    WT_OUTPUT=$(herdr worktree create \
      --branch "${BRANCH}" \
      --path "${WORKTREE_PATH}" \
      --label "WT: ${TASK_SLUG}" \
      --no-focus \
      --trust-repository)

    NEW_WS_ID=$(echo "$WT_OUTPUT" | jq -r '.result.open_workspace_id // empty')
    if [ -z "$NEW_WS_ID" ]; then
      NEW_WS_ID=$(herdr worktree list --json | jq -r --arg p "$(realpath "$WORKTREE_PATH")" '.result.worktrees[] | select(.path == $p) | .open_workspace_id // empty')
    fi

    PANE_ID=""
    if [ -n "$NEW_WS_ID" ]; then
      PANE_ID=$(herdr pane list --workspace "$NEW_WS_ID" | jq -r '.result.panes[0].pane_id // empty')
    fi

    cat <<EOF
{
  "task_slug": "${TASK_SLUG}",
  "branch": "${BRANCH}",
  "worktree_path": "${WORKTREE_PATH}",
  "workspace_id": "${NEW_WS_ID}",
  "pane_id": "${PANE_ID}",
  "agent_name": "${AGENT_NAME}",
  "brief_target_path": "${WORKTREE_PATH}/.task-brief.local.md",
  "status": "initialized"
}
EOF
    ;;

  launch)
    # Stage 2: Start agy and prompt after brief has been written
    TASK_SLUG="${2:?Task slug required for launch}"
    WORKTREE_PATH=".worktrees/${TASK_SLUG}"
    AGENT_NAME="agy-${TASK_SLUG}"
    BRIEF_FILE="${WORKTREE_PATH}/.task-brief.local.md"

    if [ ! -f "$BRIEF_FILE" ]; then
      echo >&2 "[ERROR] Brief file '$BRIEF_FILE' does not exist. Write it before launch."
      exit 1
    fi

    # Find pane ID if not supplied
    PANE_ID="${3:-}"
    if [ -z "$PANE_ID" ]; then
      WS_ID=$(herdr worktree list --json | jq -r --arg p "$(realpath "$WORKTREE_PATH")" '.result.worktrees[] | select(.path == $p) | .open_workspace_id // empty')
      if [ -n "$WS_ID" ]; then
        PANE_ID=$(herdr pane list --workspace "$WS_ID" | jq -r '.result.panes[0].pane_id // empty')
      fi
    fi

    if [ -n "$PANE_ID" ]; then
      herdr agent start "${AGENT_NAME}" --kind agy --pane "${PANE_ID}" >/dev/null
      herdr agent prompt "${AGENT_NAME}" \
        "Vui lòng đọc kỹ .task-brief.local.md. Hãy viết test tái hiện vấn đề/yêu cầu, thực hiện sửa đổi code, chạy bộ test kiểm tra pass 100%, và báo cáo tóm tắt khi hoàn thành." >/dev/null
    fi

    cat <<EOF
{
  "task_slug": "${TASK_SLUG}",
  "worktree_path": "${WORKTREE_PATH}",
  "agent_name": "${AGENT_NAME}",
  "pane_id": "${PANE_ID}",
  "status": "launched"
}
EOF
    ;;

  *)
    echo >&2 "Usage: $0 {init <prefix> | launch <task_slug> [pane_id]}"
    exit 1
    ;;
esac
