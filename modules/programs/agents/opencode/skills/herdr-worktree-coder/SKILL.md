---
name: herdr-worktree-coder
description: >
  Dispatch a dedicated Antigravity CLI (agy) coding & validation session inside an isolated Git worktree workspace via Herdr UI.
  Packages rich context directly into `.worktrees/<slug>/.task-brief.local.md` (zero root pollution, concurrency-safe for multiple agents),
  uses `spawn-worktree-agy.sh` pipeline (init -> write brief -> launch) with automatic Herdr source workspace resolution and Antigravity auto-trusting (eliminating "accept this folder" prompts),
  starts an interactive `agy` session without focus theft while keeping user CLI access (`attach`/`focus`) immediate, monitors execution in the background via Herdr Agent API, and presents verified diffs for user review before merging.
  ALWAYS use when user wants to implement or validate code in an isolated git worktree, delegate coding tasks to a fresh agy session in Herdr,
  or combine Herdr workspaces with Antigravity validation.
  Triggers (VN): "code trong worktree", "chạy agy trong worktree", "validate bằng worktree", "mở worktree herdr", "tạo session agy mới trong worktree", "cô lập code test", "mở agy bằng herdr".
  Triggers (EN): "worktree coder", "herdr worktree agy", "isolated worktree validation", "run agy in worktree", "clean session coding", "open agy in herdr worktree".
---

# Herdr Worktree Coder & Validator

An empirical, concurrency-safe coding workflow that orchestrates a pristine **Antigravity CLI (`agy`)** interactive session inside a dedicated **Git Worktree Workspace** managed directly by **Herdr UI**.

It guarantees **Zero Root Pollution, Pre-Trusted Workspace Authorization, & Direct User CLI Access**:

- **Automatic Folder Trusting**: Pre-registers `.worktrees/<slug>` into `~/.gemini/antigravity-cli/settings.json` (`trustedWorkspaces`) during initialization so `agy` never pauses to ask the user to "accept this folder".
- **User CLI Accessibility**: Runs in the background without focus theft, but provides immediate user access via `herdr agent attach` / `herdr agent focus` or the Herdr UI tab.
- **Strict User-Side Review Gate**: Changes must be empirically verified, diff-checked, and explicitly confirmed by the user before any merge or cleanup.

---

## 1. Architectural Overview

```
[Main Agent 1 / 2 / N: Bug or Feature Tasks]
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 1: Init Worktree       │ ──► `spawn-worktree-agy.sh init <prefix>`
          │ (Auto WS & Settings Trust)  │     Auto-binds repo WS, pre-trusts dir in settings.json
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
          │ (Zero Prompts, User Access) │     Interactive agy starts smoothly; user can attach/focus
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
          │ Step 5: User-Side Review &  │ ──► User confirms before merge/cherry-pick
          │ Validation Gate (Mandatory) │     and worktree removal
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

The script automatically detects the base repository workspace in Herdr, creates the worktree and pane, pre-registers the directory into `~/.gemini/antigravity-cli/settings.json` under `trustedWorkspaces`, and returns:

```json
{
  "task_slug": "fix-auth",
  "branch": "wt/fix-auth",
  "worktree_path": ".worktrees/fix-auth",
  "workspace_id": "wY",
  "pane_id": "wY:p1",
  "agent_name": "agy-fix-auth",
  "brief_target_path": ".worktrees/fix-auth/.task-brief.local.md",
  "user_attach_cmd": "herdr agent attach agy-fix-auth",
  "user_focus_cmd": "herdr agent focus agy-fix-auth",
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

Once the brief file is written, trigger the launch with just the task slug:

```bash
LAUNCH_JSON=$("${SPAWN_SCRIPT}" launch "<TASK_SLUG>")
echo "$LAUNCH_JSON"
```

This starts `agy` cleanly in the worktree's Herdr pane without any directory trust prompt, submits the execution prompt, and leaves your current pane focused and responsive.

#### User CLI Access (Interactive Inspection)

If you or the user wish to jump directly into the agent's interactive terminal session at any point:

- **Attach to terminal**:
  ```bash
  herdr agent attach "agy-<TASK_SLUG>"
  ```
- **Focus pane in Herdr UI**:
  ```bash
  herdr agent focus "agy-<TASK_SLUG>"
  ```
- Or click the worktree workspace tab directly in Herdr UI.

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

### Step 5: User-Side Review & Validation Gate (Mandatory)

Always present the full diff, test output, and Herdr workspace location to the user for explicit confirmation before taking further action:

````markdown
### 🚀 Worktree Validation Summary

- **Worktree Path**: `.worktrees/fix-auth`
- **Herdr Workspace ID**: `wY` (Agent: `agy-fix-auth`)
- **Interactive CLI Access**: `herdr agent attach agy-fix-auth` | `herdr agent focus agy-fix-auth`
- **Status**: ✅ All tests passing empirically
- **Changed Files**:
  - `src/lib/feature.ts`: Fixed edge case
  - `tests/feature.test.ts`: Added regression test

```diff
[Insert git diff here]
```
````

💡 _Bạn có thể switch sang workspace `wY` trong Herdr UI hoặc chạy `herdr agent attach agy-fix-auth` để trực tiếp tương tác với CLI._

Do you want to:

1. Merge branch `wt/fix-auth` into current branch and remove worktree?
2. Keep worktree workspace open in Herdr for further manual inspection?

````

---

### Step 6: Cleanup (Upon User Approval)

When user confirms Option 1 (merge changes):
```bash
SPAWN_SCRIPT="${HOME}/.config/home-manager/modules/programs/agents/opencode/skills/herdr-worktree-coder/scripts/spawn-worktree-agy.sh"
TASK_SLUG="<TASK_SLUG>"
BRANCH="wt/${TASK_SLUG}"

# 1. Merge into main branch
git merge "${BRANCH}"

# 2. Automatically close Herdr workspace, untrust directory, remove worktree checkout, and delete branch
"${SPAWN_SCRIPT}" cleanup "${TASK_SLUG}"
````

_(Or manually: `herdr workspace close <WORKSPACE_ID>`, `herdr worktree remove <WORKTREE_PATH>`, `git branch -d <BRANCH>`, `"${SPAWN_SCRIPT}" untrust <WORKTREE_PATH>`)_
