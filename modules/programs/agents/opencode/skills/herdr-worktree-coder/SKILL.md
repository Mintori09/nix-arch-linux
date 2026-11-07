---
name: herdr-worktree-coder
description: >
  Dispatch a dedicated Antigravity CLI (agy) coding & validation session inside an isolated Git worktree workspace via Herdr UI.
  Packages rich context into a `.task-brief.md` markdown file, creates an isolated worktree workspace in Herdr (`herdr worktree create --no-focus`),
  starts a live interactive `agy` session in that worktree's pane (`herdr agent start --kind agy`), prompts it with the task brief,
  monitors its execution in the background via Herdr Agent API, inspects empirical test & diff proofs, and reports back for user review before merging.
  ALWAYS use when user wants to implement or validate code in an isolated git worktree, delegate coding tasks to a fresh agy session in Herdr,
  or combine Herdr workspaces with Antigravity validation.
  Triggers (VN): "code trong worktree", "chạy agy trong worktree", "validate bằng worktree", "mở worktree herdr", "tạo session agy mới trong worktree", "cô lập code test", "mở agy bằng herdr".
  Triggers (EN): "worktree coder", "herdr worktree agy", "isolated worktree validation", "run agy in worktree", "clean session coding", "open agy in herdr worktree".
---

# Herdr Worktree Coder & Validator

An empirical, isolated coding workflow that orchestrates a pristine **Antigravity CLI (`agy`)** interactive session inside a dedicated **Git Worktree Workspace** managed directly by **Herdr UI**. 

This prevents context pollution, keeps the primary working directory clean, guarantees reproducibility via isolated tests, runs completely in the background without stealing UI focus, and requires explicit user review before any code is merged back into the main branch.

---

## 1. Architectural Overview

```
[User / Main Agent: Bug, Refactor, or Feature Task]
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 1: Package Context     │ ──► Generates `.task-brief.md`
          │ (AST symbols, files, tests) │
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 2: Create Worktree WS  │ ──► `herdr worktree create --no-focus`
          │ (Dedicated Herdr Workspace) │     Creates branch `wt/<name>` & isolated workspace
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 3: Start `agy` in Pane │ ──► `herdr agent start agy-<name> --kind agy`
          │ & Submit Context Prompt     │     `herdr agent prompt agy-<name> "Read .task-brief.md..."`
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 4: Autonomous Monitor  │ ◄── `herdr agent wait --until done --until idle`
          │ in Background & Read Output │     `herdr agent read agy-<name>` + `git diff`
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 5: Diff Review &       │ ──► User reviews diff; can view live in Herdr UI;
          │ Workspace Cleanup Gate      │     Confirms before merge and worktree removal
          └─────────────────────────────┘
```

---

## 2. Step-by-Step Execution Workflow

### Step 1: Context Brief Packaging

Before creating worktrees or launching `agy`, package the exact requirements into a structured markdown document named `.task-brief.md`:

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

### Step 2: Worktree Workspace Provisioning in Herdr

Ensure Herdr is active (`HERDR_ENV=1` or active Herdr socket):

```bash
# 1. Define unique branch name and worktree path
TASK_SLUG="fix-issue-$(date +%s)"
WORKTREE_BRANCH="wt/${TASK_SLUG}"
WORKTREE_PATH=".worktrees/${TASK_SLUG}"

# 2. Create dedicated Git worktree and workspace in Herdr without stealing user focus
herdr worktree create \
  --branch "${WORKTREE_BRANCH}" \
  --path "${WORKTREE_PATH}" \
  --label "WT: ${TASK_SLUG}" \
  --no-focus \
  --trust-repository
```

Herdr will output JSON containing the new workspace details:
```json
{
  "id": "cli:worktree:create",
  "result": {
    "open_workspace_id": "<NEW_WS_ID>",
    "path": "/absolute/path/to/.worktrees/...",
    ...
  }
}
```

Write or copy the `.task-brief.md` into the root of the newly created worktree:
```bash
cp /path/to/.task-brief.md "${WORKTREE_PATH}/.task-brief.md"
```

---

### Step 3: Launch Interactive `agy` in the Worktree Pane

1. Discover the root pane ID inside the new workspace:
   ```bash
   herdr pane list --workspace "<NEW_WS_ID>"
   ```
   Extract `.result.panes[0].pane_id` (e.g. `wR:p1`).

2. Start the interactive `agy` agent in that pane:
   ```bash
   AGENT_NAME="agy-${TASK_SLUG}"
   herdr agent start "${AGENT_NAME}" --kind agy --pane "<PANE_ID>"
   ```

3. Submit the mission prompt to the newly started `agy` agent:
   ```bash
   herdr agent prompt "${AGENT_NAME}" \
     "Vui lòng đọc kỹ .task-brief.md. Hãy viết test tái hiện vấn đề/yêu cầu, thực hiện sửa đổi code, chạy bộ test kiểm tra pass 100%, và báo cáo tóm tắt khi hoàn thành."
   ```

---

### Step 4: Autonomous Background Monitoring

While `agy` works in the background, the Main Agent can monitor the agent's lifecycle without freezing the conversation:

1. Wait for completion or idle state:
   ```bash
   herdr agent wait "${AGENT_NAME}" --until done --until idle --timeout 300000
   ```

2. Inspect the agent's terminal output:
   ```bash
   herdr agent read "${AGENT_NAME}" --lines 80
   ```

3. Empirically verify the code changes in the worktree:
   ```bash
   git -C "${WORKTREE_PATH}" status -s
   git -C "${WORKTREE_PATH}" diff
   ```

---

### Step 5: Review & User Confirmation Gate

Present the full diff, test output, and Herdr location to the user:

```markdown
### 🚀 Worktree Validation Summary
- **Worktree Path**: `.worktrees/fix-issue-12345`
- **Herdr Workspace ID**: `wR` (Agent: `agy-fix-issue-12345`)
- **Status**: ✅ All tests passing empirically
- **Changed Files**:
  - `src/lib/feature.ts`: Fixed edge case
  - `tests/feature.test.ts`: Added regression test

```diff
[Insert git diff here]
```

💡 *Bạn có thể switch sang workspace `wR` trong Herdr UI để xem trực tiếp phiên làm việc của `agy`.*

Do you want to:
1. Merge branch `wt/fix-issue-12345` into current branch and remove worktree?
2. Keep worktree workspace open in Herdr for further manual inspection?
```

---

### Step 6: Cleanup (Upon Approval)

When user confirms merging and cleanup:
```bash
# 1. Merge into main branch
git merge "${WORKTREE_BRANCH}"

# 2. Remove worktree workspace from Herdr and delete worktree directory
herdr worktree remove "${WORKTREE_PATH}"

# 3. Clean up branch
git branch -d "${WORKTREE_BRANCH}"
```

---

## 3. Fallback Mode (When Outside Herdr)

If running outside Herdr (`HERDR_ENV != 1`):
1. Create git worktree manually: `git worktree add -b "${WORKTREE_BRANCH}" "${WORKTREE_PATH}" HEAD`
2. Run headless `agy`:
   ```bash
   (cd "${WORKTREE_PATH}" && agy --new-project --mode auto -p "Đọc .task-brief.md, viết test, sửa code và verify pass.")
   ```
3. Inspect diff and clean up with `git worktree remove "${WORKTREE_PATH}"`.
