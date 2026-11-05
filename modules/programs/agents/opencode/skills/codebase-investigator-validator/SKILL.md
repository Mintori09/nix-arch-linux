---
name: codebase-investigator-validator
description: >
  Deep codebase investigation, empirical bug validation, and doc-grounded solution verification.
  Accepts bug reports, error logs, and screenshots, digests the codebase with targeted context briefs (zero brute-force),
  dispatches Subagent 1 to empirically validate the root cause (repro test/command, no guesswork), formulates solutions,
  dispatches Subagent 2 to verify feasibility against the latest official docs (Context7/web) and a dry-run/PoC patch,
  and outputs a comprehensive investigation report with an actionable step-by-step execution blueprint.
  ALWAYS use when user provides bug reports, error messages, screenshots, or unexpected behavior and wants a verified, multi-agent root cause analysis and solution before modifying code.
  Triggers (VN): "điều tra bug", "tìm nguyên nhân lỗi", "mổ xẻ codebase", "validate lỗi", "xác thực giải pháp", "phân tích lỗi kèm ảnh", "sửa lỗi codebase có kiểm chứng", "investigate bug".
  Triggers (EN): "investigate bug", "codebase investigation", "validate root cause", "verified bug fix", "investigate issue with screenshot", "two-stage validation".
---

# Codebase Investigator & Two-Stage Validator

A multi-agent, empirical investigation skill that diagnoses codebase issues, validates root causes via concrete execution, verifies proposed solutions against the latest official documentation and PoC tests, and produces a structured, actionable execution blueprint.

---

## 1. Core Principles

1. **Empirical Proof Over Speculation**: No bug cause or fix is accepted on theoretical prediction alone. Root causes must be reproduced through code/test execution or unambiguous execution tracing.
2. **Strict Context Scoping (Zero Brute-Force)**: Main Agent extracts and packages minimal, precise `Context Briefs` (specific files, line spans, AST symbols, reproduction commands) before launching subagents. Never dump entire repositories or broad file trees into subagent prompts.
3. **Multi-Agent Orchestration Agnostic**: Works across OpenCode (`task` tool), Antigravity CLI (`invoke_subagent`), Claude Code (`task`/`subagent`), or serial persona switching when running in single-agent harnesses.
4. **Latest Documentation Grounding**: Fixes are cross-referenced with modern, current official documentation (via Context7, DeepWiki, or Web search) to avoid deprecated APIs or anti-patterns.
5. **Pre-Execution Blueprint Gate**: Never apply code changes directly without presenting a full empirical report and getting user confirmation on the actionable step-by-step diff blueprint.

---

## 2. Multi-Agent Lifecycle

```
[Input: Bug Description / Error Logs / Screenshot]
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Main Agent: Ingestion &     │ ◄── Parse logs, inspect screenshots, locate AST
          │ Context Brief Packaging     │     symbols, isolate candidate files/functions
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Subagent 1: Root Cause      │ ◄── Empirically reproduces bug via isolated test/
          │ Empirical Validation        │     command; outputs confirmed trace & proof
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Main Agent: Solution        │ ◄── Designs candidate architectural fix based on
          │ Formulation                 │     confirmed root cause
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Subagent 2: Feasibility &   │ ◄── Validates fix with latest docs (Context7/Web)
          │ Documentation Verification  │     + dry-run / PoC patch test
          └──────────────┬──────────────┘
                         │
                         ▼
          ┌─────────────────────────────┐
          │ Final Synthesis & Blueprint │ ──► Comprehensive Report + Step-by-Step Diff Plan
          └─────────────────────────────┘     (Awaiting User Confirmation)
```

---

## 3. Step-by-Step Execution Guide

### Step 0: Ingestion & Multimodal Analysis

- If a **screenshot / image** is provided:
  - Inspect visual elements: UI state, broken components, network tab status codes, console error overlays, or stack traces in the screenshot.
  - Extract exact error strings, visual component hierarchies, and relevant URLs or routes.
- If **logs / stack traces** are provided:
  - Extract exception class, exact message, and top frames belonging to user code (ignore 3rd-party vendor frames initially).

### Step 1: Main Agent Scoping & Context Brief Construction

To prevent subagents from brute-force searching or wasting tokens:
1. Locate candidate files, symbols, and dependencies using targeted `read_file` or grep.
2. Formulate a structured `Context Brief` with the following template:

```markdown
### 📋 Context Brief
- **Target Component / File(s)**: `path/to/file.ts` (Lines L40-L85)
- **Observed Behavior**: [Log / Screenshot detail]
- **Suspected Mechanism**: [Data-flow or state mutation hypothesis]
- **Reproduction Context**: [Command: e.g. `npm test -- path/to/test.ts` or standalone script]
- **Boundary Constraint**: Focus ONLY on the functions `foo()` and `bar()`; do NOT scan entire repo.
```

### Step 2: Dispatch Subagent 1 (Root Cause Empirical Validator)

Launch Subagent 1 (or switch to Investigator Persona) with the `Context Brief`.

**Mission for Subagent 1**:
- Verify whether the suspected root cause actually causes the failure.
- Create a minimal reproduction script (e.g. in a scratch directory or test file) or run the existing test command:
  ```bash
  # Example: isolated test execution
  npm test -- -t "reproduction test name"
  # or python:
  pytest tests/test_module.py -k "test_repro"
  ```
- **Validation Output Required**:
  - `Reproducible`: YES / NO
  - `Failure Signature`: Exact error / panic observed.
  - `Empirical Evidence`: Log output from running the repro command or line-by-line trace proving the invalid state.

*If Subagent 1 invalidates the hypothesis*: Main Agent revises the analysis and constructs a new Context Brief before re-testing.

### Step 3: Main Agent Solution Formulation

With the verified root cause in hand:
- Formulate 1-2 targeted architectural solutions addressing the exact root cause.
- Define the candidate patch logic and draft a new brief for Subagent 2.

### Step 4: Dispatch Subagent 2 (Feasibility & Documentation Validator)

Launch Subagent 2 (or switch to Solution Auditor Persona) with the proposed solution and Context Brief.

**Mission for Subagent 2**:
1. **Latest Documentation Check**:
   - Query Context7 / DeepWiki / Web Search for the library/framework version in use.
   - Verify whether the proposed APIs, flags, or configuration options are supported, deprecated, or superseded in modern releases.
   - Include direct markdown links to official documentation or GitHub issues.
2. **Dry-run / PoC Patch Verification**:
   - Apply the fix mentally or via a temporary patch in a scratch file/isolated test.
   - Re-run the reproduction command from Step 2 to ensure the failure resolves without regressions.
3. **Feasibility Verdict**:
   - `Viability Score`: High / Medium / Low
   - `Modern Standards Conformance`: Confirmed / Warning
   - `Side-effect Analysis`: Impact on existing callers and performance.

### Step 5: Final Synthesis & Actionable Execution Blueprint

Once Subagent 2 gives a positive verdict, compile the findings into a structured report for the user. Do **NOT** modify the production code yet; provide the report and wait for user approval.

---

## 4. Final Output Template

Present the result using the following markdown structure:

```markdown
# 🔍 Empirical Investigation & Verification Report

## 1. Executive Summary
- **Issue**: [Brief summary of the bug/error]
- **Confirmed Root Cause**: [Summary backed by empirical proof]
- **Verified Solution**: [Summary of the chosen fix and official doc alignment]

---

## 2. Phase 1: Empirical Root Cause Validation
- **Investigated Scope**: `path/to/target.ts#L45-L60`
- **Reproduction Method**: [Command executed or minimal test script]
- **Empirical Evidence**:
  ```text
  [Output snippet showing the actual failure]
  ```
- **Subagent 1 Verdict**: ✅ Confirmed Root Cause (Zero speculation)

---

## 3. Phase 2: Solution & Documentation Feasibility
- **Proposed Fix**: [Detailed description]
- **Modern Docs Citation**:
  - [Library Name Doc](https://official-doc-link.example.com): [Key finding / API compatibility note]
- **PoC Validation**:
  - Repro re-run status: ✅ PASSED
  - Regressions detected: None
- **Subagent 2 Verdict**: ✅ Viable & Standards-Compliant

---

## 4. Step-by-Step Execution Blueprint
*(Ready to execute upon confirmation)*

- [ ] **Step 1: File Changes**
  - File: `path/to/file.ts`
  - Action: Replace `deprecatedCall()` with `modernCall()`
  - Snippet diff:
    ```diff
    - const result = legacyMethod();
    + const result = modernMethod({ option: true });
    ```
- [ ] **Step 2: Regression & Verification Testing**
  - Run: `npm test` / `pytest`
- [ ] **Step 3: Edge Case Guard**
  - Add test case for null/undefined input in `tests/target.test.ts`.

---
> 💬 **Decision**: Do you want me to proceed with executing this plan directly?
```
