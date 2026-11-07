---
name: herdr-worktree-coder
description: >
  Dispatch a dedicated Antigravity CLI (agy) coding & validation session inside an isolated Git worktree workspace via Herdr UI.
  Packages rich context into `.task-brief.local.md`, executes the fast helper script `spawn-worktree-agy.sh` to provision the workspace
  and launch an interactive `agy` session without focus theft, monitors execution in the background via Herdr Agent API,
  and presents verified diffs for user review before merging.
  ALWAYS use when user wants to implement or validate code in an isolated git worktree, delegate coding tasks to a fresh agy session in Herdr,
  or combine Herdr workspaces with Antigravity validation.
  Triggers (VN): "code trong worktree", "chạy agy trong worktree", "validate bằng worktree", "mở worktree herdr", "tạo session agy mới trong worktree", "cô lập code test", "mở agy bằng herdr".
  Triggers (EN): "worktree coder", "herdr worktree agy", "isolated worktree validation", "run agy in worktree", "clean session coding", "open agy in herdr worktree".
---

# Herdr Worktree Coder & Validator

An empirical, streamlined coding workflow that orchestrates a pristine **Antigravity CLI (`agy`)** interactive session inside a dedicated **Git Worktree Workspace** managed directly by **Herdr UI**.

It assumes standard tooling (`git`, `agy`, `herdr`, `jq`) is pre-installed, performs a fail-fast one-pass verification via a bundled script, avoids redundant command probes, runs completely in the background without stealing UI focus, and requires explicit user review before merging.

---

## 1. Architectural Overview

```
[User / Main Agent: Bug, Refactor, or Feature Task]
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 1: Package Context     │ ──► Generates `.task-brief.local.md`
          │ (AST symbols, files, tests) │
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 2: One-Step Spawn      │ ──► Runs `spawn-worktree-agy.sh <name>`
          │ (Herdr Worktree + agy)      │     Provisions WS, starts agy & prompts non-blocking
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 3: Autonomous Monitor  │ ◄── `herdr agent wait --until done --until idle`
          │ in Background & Read Output │     `herdr agent read agy-<name>` + `git diff`
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 4: Diff Review &       │ ──► User reviews diff; can view live in Herdr UI;
          │ Workspace Cleanup Gate      │     Confirms before merge and worktree removal
          └─────────────────────────────┘
```

---

## 2. Step-by-Step Execution Workflow

### Step 1: Context Brief Packaging

First, package the exact task scope into a structured markdown document named `.task-brief.local.md` in the current project root:

```markdown
# 📋 Task Context Brief

## 1. Objective
- **Type**: [Bug Fix | Feature | Refactoring | Performance]
- **Goal**: [Clear statement of expected behavior]

## 2. Scoped Targets & AST Symbols
- **Target Files**:
  - `path/to/file.ts` (Lines ~L40-L90)
  - `path/to/service.ts` (Class `AuthService`, function `validateToken`)
- **Key Dependencies**: [Internal modules or external libraries involved]

## 3. Empirical Verification Requirements
- **Reproduction Command**: [e.g. `pnpm test tests/auth.test.ts`]
- **Expected Outcome**:
  1. Add/modify test case covering the exact edge case.
  2. Implement necessary code modifications.
  3. Ensure all tests in the package pass with zero regressions.

## 4. Boundary Constraints
- Do NOT modify unrelated configuration or files outside the target scope.
- Do NOT perform git commits or push to remote branches without instructions.
- Provide a concise final summary of changed files and test results.
```

---

### Step 2: One-Step Worktree & Agent Spawning

Execute the bundled helper script to handle prerequisite checks, worktree creation, file copying, agent startup, and initial prompting in **a single command**:

```bash
# Locate the skill helper script
SPAWN_SCRIPT="${HOME}/.config/home-manager/modules/programs/agents/opencode/skills/herdr-worktree-coder/scripts/spawn-worktree-agy.sh"

# Run spawn script (non-blocking, returns JSON)
TASK_NAME="fix-issue-$(date +%s)"
SPAWN_RESULT=$("${SPAWN_SCRIPT}" "${TASK_NAME}" .task-brief.local.md)
echo "$SPAWN_RESULT"
```

The script returns structured JSON:
```json
{
  "task_name": "fix-issue-1731000000",
  "branch": "wt/fix-issue-1731000000",
  "worktree_path": ".worktrees/fix-issue-1731000000",
  "workspace_id": "wR",
  "pane_id": "wR:p1",
  "agent_name": "agy-fix-issue-1731000000",
  "status": "spawned"
}
```

---

### Step 3: Background Monitoring & Verification

Extract `agent_name` and `worktree_path` from the JSON to monitor progress:

```bash
AGENT_NAME="agy-${TASK_NAME}"
WORKTREE_PATH=".worktrees/${TASK_NAME}"

# 1. Wait until agent finishes or returns to idle
herdr agent wait "${AGENT_NAME}" --until done --until idle --timeout 300000

# 2. Read final terminal output
herdr agent read "${AGENT_NAME}" --lines 80

# 3. Empirically inspect changes in the worktree
git -C "${WORKTREE_PATH}" status -s
git -C "${WORKTREE_PATH}" diff
```

---

### Step 4: Review & User Confirmation Gate

Present the full diff, test output, and Herdr location to the user:

```markdown
### 🚀 Worktree Validation Summary
- **Worktree Path**: `.worktrees/fix-issue-...`
- **Herdr Workspace ID**: `wR` (Agent: `agy-fix-issue-...`)
- **Status**: ✅ All tests passing empirically
- **Changed Files**:
  - `src/lib/feature.ts`: Fixed edge case
  - `tests/feature.test.ts`: Added regression test

```diff
[Insert git diff here]
```

💡 *Bạn có thể switch sang workspace `wR` trong Herdr UI để xem trực tiếp phiên làm việc của `agy`.*

Do you want to:
1. Merge branch `wt/fix-issue-...` into current branch and remove worktree?
2. Keep worktree workspace open in Herdr for further manual inspection?
```

---

### Step 5: Cleanup (Upon Approval)

When user confirms merging:
```bash
BRANCH="wt/${TASK_NAME}"

# 1. Merge into main branch
git merge "${BRANCH}"

# 2. Remove worktree workspace from Herdr
herdr worktree remove "${WORKTREE_PATH}"

# 3. Clean up branch
git branch -d "${BRANCH}"
```
