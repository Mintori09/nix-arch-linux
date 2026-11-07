#!/usr/bin/env bash
set -euo pipefail

# Fail-fast one-pass prerequisite check
for cmd in git agy herdr jq; do
  command -v "$cmd" >/dev/null 2>&1 || { echo >&2 "[ERROR] '$cmd' is required but not installed."; exit 1; }
done

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$REPO_ROOT" ]; then
  echo >&2 "[ERROR] Must run inside a Git repository."
  exit 1
fi

ACTION="${1:-all}"
TASK_PREFIX="${2:-fix}"

# Generate clean slug (use exact prefix if provided without timestamp, fallback to random hex only if conflict/empty)
generate_slug() {
  local prefix="${1:-fix}"
  echo "${prefix}"
}

# Resolve the Herdr source workspace ID for this Git repo
resolve_source_workspace() {
  local ws_list
  ws_list=$(herdr workspace list 2>/dev/null || true)
  if [ -n "$ws_list" ]; then
    # First priority: base non-linked worktree workspace for this repo
    local ws_id
    ws_id=$(echo "$ws_list" | jq -r --arg r "$REPO_ROOT" '.result.workspaces[] | select(.worktree.repo_root == $r and .worktree.is_linked_worktree == false) | .workspace_id' | head -n1)
    if [ -n "$ws_id" ]; then
      echo "$ws_id"
      return 0
    fi
    # Second priority: any workspace belonging to this repo
    ws_id=$(echo "$ws_list" | jq -r --arg r "$REPO_ROOT" '.result.workspaces[] | select(.worktree.repo_root == $r) | .workspace_id' | head -n1)
    if [ -n "$ws_id" ]; then
      echo "$ws_id"
      return 0
    fi
  fi
  # Fallback: check inherited environment variable
  echo "${HERDR_WORKSPACE_ID:-}"
}

case "$ACTION" in
  init)
    # Stage 1: Provision isolated worktree & workspace
    TASK_SLUG=$(generate_slug "$TASK_PREFIX")
    BRANCH="wt/${TASK_SLUG}"
    WORKTREE_PATH=".worktrees/${TASK_SLUG}"
    AGENT_NAME="agy-${TASK_SLUG}"

    SOURCE_WS=$(resolve_source_workspace)
    WS_ARGS=()
    if [ -n "$SOURCE_WS" ]; then
      WS_ARGS+=(--workspace "$SOURCE_WS")
    fi

    # Create worktree in Herdr (always passes source workspace to avoid not_git_worktree errors)
    WT_OUTPUT=$(herdr worktree create \
      "${WS_ARGS[@]}" \
      --branch "${BRANCH}" \
      --path "${WORKTREE_PATH}" \
      --label "WT: ${TASK_SLUG}" \
      --no-focus \
      --trust-repository)

    # Parse IDs directly from creation output
    NEW_WS_ID=$(echo "$WT_OUTPUT" | jq -r '.result.workspace.workspace_id // .result.open_workspace_id // empty')
    PANE_ID=$(echo "$WT_OUTPUT" | jq -r '.result.root_pane.pane_id // empty')

    # Persist session metadata into worktree for zero-config launch
    cat <<EOF > "${WORKTREE_PATH}/.herdr-session.json"
{
  "task_slug": "${TASK_SLUG}",
  "branch": "${BRANCH}",
  "worktree_path": "${WORKTREE_PATH}",
  "workspace_id": "${NEW_WS_ID}",
  "pane_id": "${PANE_ID}",
  "agent_name": "${AGENT_NAME}",
  "source_workspace": "${SOURCE_WS}"
}
EOF

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
    META_FILE="${WORKTREE_PATH}/.herdr-session.json"
    BRIEF_FILE="${WORKTREE_PATH}/.task-brief.local.md"

    if [ ! -f "$BRIEF_FILE" ]; then
      echo >&2 "[ERROR] Brief file '$BRIEF_FILE' does not exist. Write it before launch."
      exit 1
    fi

    PANE_ID=""
    AGENT_NAME="agy-${TASK_SLUG}"
    if [ -f "$META_FILE" ]; then
      PANE_ID=$(jq -r '.pane_id // empty' "$META_FILE")
      AGENT_NAME=$(jq -r '.agent_name // empty' "$META_FILE")
    fi

    # Fallback to query if meta file missing
    if [ -z "$PANE_ID" ]; then
      WS_ID=$(herdr worktree list --json 2>/dev/null | jq -r --arg p "$(realpath "$WORKTREE_PATH")" '.result.worktrees[] | select(.path == $p) | .open_workspace_id // empty')
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

  cleanup)
    # Stage 3: Merge, remove worktree checkout, close Herdr workspace, and delete branch
    TASK_SLUG="${2:?Task slug required for cleanup}"
    BRANCH="wt/${TASK_SLUG}"
    WORKTREE_PATH=".worktrees/${TASK_SLUG}"
    META_FILE="${WORKTREE_PATH}/.herdr-session.json"

    WORKSPACE_ID=""
    if [ -f "$META_FILE" ]; then
      WORKSPACE_ID=$(jq -r '.workspace_id // empty' "$META_FILE")
    fi

    # 1. Close workspace in Herdr if it was open
    if [ -n "$WORKSPACE_ID" ]; then
      herdr workspace close "$WORKSPACE_ID" 2>/dev/null || true
    fi

    # 2. Remove worktree checkout
    if [ -d "$WORKTREE_PATH" ]; then
      herdr worktree remove "${WORKTREE_PATH}" 2>/dev/null || git worktree remove "${WORKTREE_PATH}" --force 2>/dev/null || rm -rf "${WORKTREE_PATH}"
    fi

    # 3. Clean up branch
    git branch -D "${BRANCH}" 2>/dev/null || true

    cat <<EOF
{
  "task_slug": "${TASK_SLUG}",
  "workspace_id": "${WORKSPACE_ID}",
  "status": "cleaned"
}
EOF
    ;;

  *)
    echo >&2 "Usage: $0 {init <prefix> | launch <task_slug> | cleanup <task_slug>}"
    exit 1
    ;;
esac
