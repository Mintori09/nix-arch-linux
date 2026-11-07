---
name: herdr-worktree-coder
description: >
  Dispatch a dedicated Antigravity CLI (agy) coding & validation session inside an isolated Git worktree workspace via Herdr UI.
  Packages rich context directly into `.worktrees/<slug>/.task-brief.local.md` (zero root pollution, concurrency-safe for multiple agents),
  uses `spawn-worktree-agy.sh` pipeline (init -> write brief -> launch) to provision the workspace and start an interactive `agy` session without focus theft,
  monitors execution in the background via Herdr Agent API, and presents verified diffs for user review before merging.
  ALWAYS use when user wants to implement or validate code in an isolated git worktree, delegate coding tasks to a fresh agy session in Herdr,
  or combine Herdr workspaces with Antigravity validation.
  Triggers (VN): "code trong worktree", "chạy agy trong worktree", "validate bằng worktree", "mở worktree herdr", "tạo session agy mới trong worktree", "cô lập code test", "mở agy bằng herdr".
  Triggers (EN): "worktree coder", "herdr worktree agy", "isolated worktree validation", "run agy in worktree", "clean session coding", "open agy in herdr worktree".
---

# Herdr Worktree Coder & Validator

An empirical, concurrency-safe coding workflow that orchestrates a pristine **Antigravity CLI (`agy`)** interactive session inside a dedicated **Git Worktree Workspace** managed directly by **Herdr UI**.

It guarantees **Zero Root Pollution & Concurrency Safety**: multiple agents on `main` can run simultaneously without file collisions or race conditions. All brief files are written directly inside their isolated worktree directories (`.worktrees/<slug>/.task-brief.local.md`), completely avoiding the root working tree.

---

## 1. Architectural Overview

```
[Main Agent 1 / 2 / N: Bug or Feature Tasks]
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 1: Init Worktree       │ ──► `spawn-worktree-agy.sh init <prefix>`
          │ (Unique slug + Herdr WS)    │     Generates `fix-<ts>-<hex>` & creates worktree dir
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 2: Write In-Situ Brief │ ──► Writes `.worktrees/<slug>/.task-brief.local.md`
          │ (Zero Root Directory Drift) │     Completely isolated per agent instance
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 3: Launch agy Session  │ ──► `spawn-worktree-agy.sh launch <slug>`
          │ (Background, No Focus Theft)│     Starts interactive agy in pane & prompts brief
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 4: Autonomous Monitor  │ ◄── `herdr agent wait --until done --until idle`
          │ in Background & Read Diff   │     `herdr agent read agy-<slug>` + `git diff`
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 5: Diff Review &       │ ──► User confirms before merge/cherry-pick
          │ Workspace Cleanup Gate      │     and worktree removal
          └─────────────────────────────┘
```

---

## 2. Step-by-Step Execution Workflow

### Step 1: Initialize Worktree Workspace

Run `spawn-worktree-agy.sh init <prefix>` with a short task prefix (e.g. `fix-auth` or `feat-login`):

```bash
SPAWN_SCRIPT="${HOME}/.config/home-manager/modules/programs/agents/opencode/skills/herdr-worktree-coder/scripts/spawn-worktree-agy.sh"

INIT_JSON=$("${SPAWN_SCRIPT}" init "fix-auth")
echo "$INIT_JSON"
```

The script returns unique, collision-proof JSON:
```json
{
  "task_slug": "fix-auth-1731000000-a1b2",
  "branch": "wt/fix-auth-1731000000-a1b2",
  "worktree_path": ".worktrees/fix-auth-1731000000-a1b2",
  "workspace_id": "wR",
  "pane_id": "wR:p1",
  "agent_name": "agy-fix-auth-1731000000-a1b2",
  "brief_target_path": ".worktrees/fix-auth-1731000000-a1b2/.task-brief.local.md",
  "status": "initialized"
}
```

---

### Step 2: Write In-Situ Context Brief

Use `write_file` tool to write the scoped requirements directly to `brief_target_path` (`.worktrees/<task_slug>/.task-brief.local.md`). **Never write to the root of the project!**

Template:
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

### Step 3: Launch `agy` Agent in Worktree Workspace

Once the brief file is written, trigger the launch:

```bash
LAUNCH_JSON=$("${SPAWN_SCRIPT}" launch "<TASK_SLUG>")
echo "$LAUNCH_JSON"
```

This starts `agy` in the worktree's Herdr pane, submits the execution prompt, and leaves your current pane focused and responsive.

---

### Step 4: Background Monitoring & Verification

Extract `agent_name` and `worktree_path` to track progress:

```bash
AGENT_NAME="agy-<TASK_SLUG>"
WORKTREE_PATH=".worktrees/<TASK_SLUG>"

# 1. Wait until agent finishes or returns to idle
herdr agent wait "${AGENT_NAME}" --until done --until idle --timeout 300000

# 2. Read final terminal output
herdr agent read "${AGENT_NAME}" --lines 80

# 3. Empirically inspect changes in the worktree
git -C "${WORKTREE_PATH}" status -s
git -C "${WORKTREE_PATH}" diff
```

---

### Step 5: Review & User Confirmation Gate

Present the full diff, test output, and Herdr workspace location to the user:

```markdown
### 🚀 Worktree Validation Summary
- **Worktree Path**: `.worktrees/fix-auth-1731000000-a1b2`
- **Herdr Workspace ID**: `wR` (Agent: `agy-fix-auth-1731000000-a1b2`)
- **Status**: ✅ All tests passing empirically
- **Changed Files**:
  - `src/lib/feature.ts`: Fixed edge case
  - `tests/feature.test.ts`: Added regression test

```diff
[Insert git diff here]
```

💡 *Bạn có thể switch sang workspace `wR` trong Herdr UI để xem trực tiếp phiên làm việc của `agy`.*

Do you want to:
1. Merge branch `wt/fix-auth-...` into current branch and remove worktree?
2. Keep worktree workspace open in Herdr for further manual inspection?
```

---

### Step 6: Cleanup (Upon Approval)

When user confirms merging:
```bash
BRANCH="wt/<TASK_SLUG>"

# 1. Merge into main branch
git merge "${BRANCH}"

# 2. Remove worktree workspace from Herdr
herdr worktree remove "${WORKTREE_PATH}"

# 3. Clean up branch
git branch -d "${BRANCH}"
```
