---
name: herdr-worktree-coder
description: >
  Dispatch a dedicated Antigravity CLI (agy) coding & validation session inside an isolated Git worktree via Herdr UI.
  Packages rich context into a `.task-brief.md` markdown file, spawns a pristine worktree tab and agy agent in Herdr
  (with graceful fallback to CLI git worktree + agy print mode), executes empirical tests & fixes in sandbox isolation,
  verifies test passing, and returns diff reports for user approval before merging.
  ALWAYS use when user wants to implement or validate code in an isolated git worktree, delegate coding tasks to a fresh agy session,
  or combine Herdr workspaces with Antigravity validation.
  Triggers (VN): "code trong worktree", "chạy agy trong worktree", "validate bằng worktree", "mở worktree herdr", "tạo session agy mới trong worktree", "cô lập code test".
  Triggers (EN): "worktree coder", "herdr worktree agy", "isolated worktree validation", "run agy in worktree", "clean session coding".
---

# Herdr Worktree Coder & Validator

An empirical, isolated coding workflow that orchestrates a pristine **Antigravity CLI (`agy`)** sub-session inside a dedicated **Git Worktree** managed by **Herdr UI**. 

This prevents context pollution, keeps the primary working directory clean, guarantees reproducibility via isolated tests, and requires explicit user review before any code is merged back into the main branch.

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
          │ Step 2: Provision Worktree  │ ──► Creates `.worktrees/<feature-name>`
          │ (Herdr UI / Git Worktree)   │     Isolated branch `fix/<name>` or `feat/<name>`
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 3: Spawn Pristine `agy`│ ──► Fresh session, zero context drift
          │ Session in Worktree         │     Reads `.task-brief.md`
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 4: Empirical Code &    │ ◄── 1. Write repro test
          │ Validation inside Worktree  │     2. Implement code fix
          └──────────────┬──────────────┘     3. Verify test suite passes 100%
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Step 5: Diff Review &       │ ──► User confirms before merge/cherry-pick
          │ Workspace Cleanup Gate      │     and worktree removal
          └─────────────────────────────┘
```

---

## 2. Step-by-Step Execution Workflow

### Step 1: Context Brief Packaging

Before touching git worktrees or launching `agy`, the Main Agent must isolate and summarize the exact scope to prevent token waste and hallucinations.

Create a file named `.task-brief.md` (or write it directly into the target worktree root after creation):

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

### Step 2: Worktree Provisioning

Check if running inside Herdr (`HERDR_ENV=1` or active Herdr socket):

#### Option A: Inside Herdr (Preferred)
```bash
# 1. Generate unique worktree name
WORKTREE_NAME="fix-$(date +%s)"
WORKTREE_PATH=".worktrees/${WORKTREE_NAME}"

# 2. Create and open worktree in Herdr
herdr worktree create \
  --branch "${WORKTREE_NAME}" \
  --path "${WORKTREE_PATH}" \
  --label "Worktree: ${WORKTREE_NAME}" \
  --trust-repository
```

#### Option B: Standalone / Fallback (Outside Herdr)
```bash
WORKTREE_NAME="fix-$(date +%s)"
WORKTREE_PATH=".worktrees/${WORKTREE_NAME}"

# Create git worktree
git worktree add -b "${WORKTREE_NAME}" "${WORKTREE_PATH}" HEAD
```

Copy the `.task-brief.md` into `${WORKTREE_PATH}/.task-brief.md`.

---

### Step 3: Launch Pristine `agy` Session

#### Option A: Herdr Agent Session
1. Locate the newly created worktree pane ID via:
   ```bash
   herdr pane list --json
   ```
2. Start `agy` in that pane:
   ```bash
   herdr agent start "agy-${WORKTREE_NAME}" --kind agy --pane "<PANE_ID>"
   ```
3. Prompt `agy` with instructions to process `.task-brief.md`:
   ```bash
   herdr agent prompt "agy-${WORKTREE_NAME}" \
     "Please read .task-brief.md carefully. Write reproduction tests, implement the fix, run the verification commands to confirm all tests pass, and report when finished." \
     --wait
   ```

#### Option B: Standalone / Headless Fallback
When running headless or outside Herdr UI:
```bash
(
  cd "${WORKTREE_PATH}" && \
  agy --new-project --mode auto -p \
    "Please read .task-brief.md. Write reproduction tests, implement the required code changes, run the test suites to empirically verify the solution, and output your final execution summary."
)
```

---

### Step 4: Validate Empirical Evidence

Inspect the worktree state:
```bash
# Inspect git status & diff inside worktree
git -C "${WORKTREE_PATH}" status -s
git -C "${WORKTREE_PATH}" diff

# Confirm tests pass
# (Run package-specific test command, e.g. pnpm test, cargo test, etc.)
```

---

### Step 5: Review & User Confirmation Gate

Present the full diff and test results to the user:

```markdown
### 🚀 Worktree Validation Summary
- **Worktree**: `.worktrees/fix-12345678` (Branch: `fix-12345678`)
- **Status**: ✅ All tests passing
- **Changes Summary**:
  - `src/core/auth.ts`: Fixed token expiration calculation
  - `tests/core/auth.test.ts`: Added regression test case

```diff
[Insert git diff here]
```

Do you want to:
1. Merge branch `fix-12345678` into current branch and remove worktree?
2. Keep worktree for manual inspection in Herdr?
```

### Step 6: Cleanup (Upon Approval)

When user approves:
```bash
# 1. Merge or apply changes to main branch
git merge "${WORKTREE_NAME}"

# 2. Remove worktree
herdr worktree remove "${WORKTREE_PATH}" 2>/dev/null || git worktree remove "${WORKTREE_PATH}"

# 3. Clean up branch
git branch -d "${WORKTREE_NAME}"
```

---

## 3. Best Practices & Safeguards

- **Never force-delete unmerged worktrees**: Always check `git -C "${WORKTREE_PATH}" diff` before running `git worktree remove --force`.
- **Ignore Worktrees directory in `.gitignore`**: Ensure `.worktrees/` is included in the project's `.gitignore` or local `.git/info/exclude`.
- **Pristine Environment**: Using `agy --new-project` ensures zero memory or scratch leakage from previous debugging sessions.
