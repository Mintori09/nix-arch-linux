---
name: plan-auditor
description: >
  Interactive multi-perspective architectural review, code validation, external evidence verification, and historical comparison
  for technical plans, bug fixes, and feature proposals. When no plan exists, investigates the problem, explores the codebase,
  searches online docs, and synthesizes a high-confidence plan from scratch. Analyzes plans against the actual codebase and validates
  with reputable online documentation/RFCs/official sources. Cross-examines competing ideas/hypotheses in comparative tables to determine
  the most sound approach, interactively asks clarifying questions across critical vectors (stability, performance, edge cases,
  security, architecture, test strategy), compares with past plans/reports, and writes structured audit reports
  with detailed, granular implementation steps.
  ALWAYS use when user wants to validate a plan, draft a plan from a bug/feature request, review an architecture proposal,
  audit a bug fix design, verify against official internet standards/docs, or perform regression/comparison analysis.
  Triggers (VN): "audit plan", "review plan", "đánh giá plan", "kiểm tra plan với code", "so sánh plan", "so sánh báo cáo", "phản biện plan", "validate plan", "so sánh suy đoán", "tra cứu tài liệu", "kiểm chứng nguồn", "lập plan cho lỗi", "tìm hiểu và viết plan", "draft plan từ vấn đề".
  Triggers (EN): "audit plan", "review plan", "validate plan against code", "draft plan", "create plan from issue", "compare plans", "plan peer review", "architectural plan audit", "hypothesis comparison", "external validation", "fact check with docs".
---

# Plan Auditor & Codebase Validator (with Investigation & Fact-Checked Planning)

A structured, interactive skill to investigate problems, draft plans from scratch when none exist, audit technical plans (bug fixes, feature proposals, architectural refactors), validate them against both the ground-truth codebase and reputable online documentation (RFCs, official framework docs, GitHub issues, CVEs), arbitrate between competing hypotheses in comparative matrices, compare revisions, and produce granular, high-confidence implementation blueprints.

---

## 1. Core Principles

1. **Stability & Performance First**: Always prioritize zero-regression, resource efficiency, latency, and system stability over syntactic sugar or over-engineering.
2. **Dual Ground Truth (Codebase + External Sources)**:
   - **Codebase Truth**: Cross-reference every assumption, function signature, data model, and import path with the actual files in the repository.
   - **External Truth**: Validate architectural choices, library behaviors, and bug fixes against official documentation, RFC standards, official release notes, or confirmed GitHub issues/discussions. Provide clickable, authoritative markdown links.
3. **Adaptive Ingestion (Drafting vs Auditing)**:
   - **If Plan Exists**: Audit, validate, critique, and refine it.
   - **If No Plan Exists (Only Problem / Request)**: Actively investigate the codebase, reproduce the root cause, search official documentation for recommended patterns, formulate competing hypotheses, and synthesize a complete `plan.v1.md` before proceeding to the audit & refined action plan.
4. **Hypothesis Arbitration (In Bảng So Sánh Suy Đoán)**: When comparing two differing opinions or hypotheses (e.g. Plan A vs Plan B, User's draft vs Existing pattern, or Cause X vs Cause Y for a bug), pit them directly against each other in a structured evaluation table with concrete evidence from the code and external citations to determine which is more sound.
5. **Interactive Socratic Inquiries**: Do not dump assumptions. Probe the author interactively on ambiguity, missing invariants, failure recovery, and trade-offs.
6. **Granular, Actionable Implementation Details**: Instead of high-level bullet points, provide explicit code snippets, exact function signatures, file paths, and step-by-step checklists of what will be done.
7. **Historical Comparison & Delta Auditing**: When previous versions of plans or reports exist, highlight resolved risks, introduced regressions, and rationale differences.

---

## 2. Storage Conventions

Plans and Audit Reports should be stored in the project's documentation folder or centralized plan location:

- **Project Root**: `.plans/` or `docs/plans/` (e.g. `docs/plans/<topic>/`)
- **Centralized Fallback**: `~/.local/share/plans/<project-name>/<topic>/`
- **File Naming Standard**:
  - Original/Draft Plan: `plan.v<N>.md` (e.g. `plan.v1.md`, `plan.v2.md`)
  - Audit Report: `audit-report.v<N>.md`
  - Delta / Comparison: `delta-v<A>-to-v<B>.md`
  - Executable Refined Plan: `action-plan.refined.md`

---

## 3. Workflow Lifecycle

```
[Input: Problem Description / Bug Report / User Plan]
                         │
                         ▼
        ┌──────────────────────────────────┐
        │ 0. Ingestion & Pre-Investigation │ ◄── Check if Plan exists; if not: trace code,
        └────────────────┬─────────────────┘     reproduce root cause, search official docs
                         │
                         ▼
             ┌───────────────────────┐
             │ 1. Codebase Grounding │ ◄── Inspect symbols, call-sites, configs, types
             └───────────┬───────────┘
                         │
                         ▼
             ┌───────────────────────┐
             │ 2. Web & Doc Search   │ ◄── Validate via Official Docs, RFCs, GitHub Issues
             └───────────┬───────────┘
                         │
                         ▼
             ┌───────────────────────┐
             │ 3. Hypothesis Matrix  │ ◄── Arbitrate competing views/hypotheses (Table)
             └───────────┬───────────┘
                         │
                         ▼
             ┌───────────────────────┐
             │ 4. Multi-Vector Audit │
             │  - Stability & Latency│
             │  - Edge Cases & Race  │
             │  - Security & Inputs  │
             │  - Architecture/Tests │
             └───────────┬───────────┘
                         │
                         ▼
             ┌───────────────────────┐
             │ 5. Interactive Inquest│ ◄── Ask targeted questions (one vector at a time)
             └───────────┬───────────┘
                         │
                         ▼
             ┌───────────────────────┐
             │ 6. Historical Delta   │ ◄── (If past plan/report exists) Diff & regression check
             └───────────┬───────────┘
                         │
                         ▼
             ┌───────────────────────┐
             │ 7. Detailed Artifacts │ ──► plan.v1.md / Audit Report + Granular Action Plan
             └───────────────────────┘
```

---

## 4. Execution Steps

### Step 0: Pre-Investigation & Drafting (When No Plan Exists)

If the user only provides a problem description, bug, or feature request without an existing plan:
1. **Explore the Code**: Trace execution paths from entry point to failure site / insertion point.
2. **Consult Official Docs**: Research standard patterns, framework idioms, or known library quirks on the web.
3. **Draft Initial Plan (`plan.v1.md`)**:
   - Problem summary and identified root causes.
   - Proposed architecture / solution approaches.
   - Impacted modules and interfaces.

### Step 1: Codebase Grounding & Reality Check

Before forming opinions or asking questions, read the relevant code:
1. Grep and inspect all files, modules, database schemas, and endpoints mentioned in the plan/issue.
2. Verify:
   - Do the functions/classes exist and behave as expected?
   - Are dependencies, lock files, or types up to date?
   - What existing patterns/idioms are used across the codebase?
   - What hidden side-effects or call sites might be impacted?

### Step 2: External Fact-Checking & Web Validation

Validate external library behaviors, best practices, or bug mechanisms:
1. Perform targeted searches for:
   - Official API reference / framework docs (e.g. MDN, React Docs, Node.js docs, Nixpkgs manual, Postgres docs).
   - Known upstream issues, breaking changes, or deprecation notices on GitHub/GitLab.
   - RFC standards / Security advisories (CVE, OWASP).
2. Collect authoritative URLs and specific quotes to substantiate arguments.

### Step 3: Competing Hypotheses & Trade-off Arbitration (Bảng So Sánh Suy Đoán)

When there are multiple viewpoints, competing solutions, or conflicting hypotheses about a bug / feature:
- Construct a comparison table scoring each approach across:
  - **Codebase Evidence** (bằng chứng từ code thực tế)
  - **External Validation / Docs Citation** (kiểm chứng từ tài liệu chính thức / internet)
  - **Performance & Stability Impact** (tác động hiệu năng & độ ổn định)
  - **Edge Cases & Maintenance** (trường hợp biên & bảo trì)
- Clearly declare the **Winning / More Sound Approach (Bên hợp lý hơn)** and justify with concrete code references + external URLs.

### Step 4: Multi-Vector Audit Evaluation

Examine the plan across 5 mandatory vectors:

| Vector | Focus Questions |
| :--- | :--- |
| **1. Stability & Performance (Top Priority)** | Will this cause CPU/Memory spikes, slow queries, I/O bottlenecks, blocking event loops, or memory leaks? Is there unnecessary overhead? |
| **2. Edge Cases & Concurrency** | How does it handle null/empty states, network timeouts, disconnections, race conditions, atomic mutations, or idempotency? |
| **3. Security & Validation** | Are inputs strictly sanitized? Are secrets/tokens exposed? Are permission checks bypassed? |
| **4. Architecture & Consistency** | Does it follow existing codebase patterns? Does it introduce unnecessary abstractions or circular dependencies? |
| **5. Testability & Verification** | How can this be verified automatically? Unit test, integration test, or deterministic reproduction script? |

### Step 5: Interactive Clarification (One Topic at a Time)

Ask the user specific, concise clarifying questions based on ambiguities or critical findings found during Steps 0-4:
- State the context and file reference.
- Present the trade-off or risk.
- Ask for user intent or preferred mitigation before finalizing the report.

### Step 6: Historical Comparison (Delta Analysis)

If previous plan versions or audit reports are provided (or found in `.plans/` / `docs/plans/`):
1. **Resolved Items**: What past concerns were successfully mitigated?
2. **Regression Risks**: Did the new changes accidentally remove safety checks or create new bottlenecks?
3. **Complexity Delta**: Did the solution get cleaner or more convoluted?

### Step 7: Output Structured Audit Report & Detailed Action Plan

Write the final output files and present them cleanly with granular, step-by-step code details.

---

## 5. Standard Output Template (`audit-report.v<N>.md`)

```markdown
# Audit Report: [Plan Title] (v<N>)

**Date**: YYYY-MM-DD
**Target Module**: `path/to/module`
**Status**: [APPROVED / REVISION_REQUIRED / BLOCKED]

---

## 1. Executive Summary & Verdict
- **Confidence Score**: (1-10)
- **Top Strengths**:
- **Critical Blockers / High Risks**:

---

## 2. Codebase & External Validation Matrix
| Plan Assumption | Actual Code Status | External Verification (Docs / RFC) | Validity | Notes / Evidence |
| :--- | :--- | :--- | :--- | :--- |
| e.g. "Fetch API handles abort automatically" | Missing AbortController | [MDN: AbortController](https://developer.mozilla.org/...) | ⚠️ Mismatch | `src/api.ts#L42` - Cần truyền signal |

---

## 3. Hypothesis & Competing Approaches Arbitration (Bảng So Sánh Suy Đoán)
| Tiêu chí / Vấn đề | Hướng / Suy đoán A (e.g. Cách hiện tại/Ý tưởng 1) | Hướng / Suy đoán B (e.g. Đề xuất tối ưu/Ý tưởng 2) | Bên hợp lý hơn & Bằng chứng (Code + Nguồn uy tín) |
| :--- | :--- | :--- | :--- |
| **Bản chất nguyên nhân / Thiết kế** | Suy đoán A... | Suy đoán B... | **Bên B**: Code thực tế tại `file#L10` và [Docs chính thức](https://...) xác nhận... |
| **Hiệu năng & Tài nguyên** | Tác động của A | Tác động của B | **Bên B**: [Benchmark / RFC link](https://...) chỉ ra tiết kiệm O(N) |
| **Độ rủi ro & Edge Cases** | Rủi ro của A | Rủi ro của B | **Bên B**: Khắc phục race condition theo khuyến nghị [GitHub Issue #123](https://...) |
| **Độ phức tạp bảo trì** | Khó test / tech debt | Dễ đọc / tuân thủ pattern | **Bên B**: Chuẩn hóa theo kiến trúc hiện tại |

> **Kết luận bên hợp lý hơn**: [Đánh giá tổng thể và lý do lựa chọn phương án tối ưu nhất dựa trên code thực tế và tài liệu uy tín]

---

## 4. Deep-Dive Vector Analysis
### 🚀 Stability, Performance & Resource Efficiency
- [Findings, potential bottlenecks, O(N) risks, memory impacts]

### 🛡️ Edge Cases, Concurrency & Failure Modes
- [Network failure handling, race conditions, atomic guarantees]

### 🔒 Security, Validation & Boundaries
- [Auth checks, input validation, leak risks, CVE references]

### 📐 Architecture, Cleanliness & Patterns
- [Cohesion, coupling, consistency with existing code]

### 🧪 Testing & Verification Strategy
- [Automated test plan, mocks needed, benchmark checklist]

---

## 5. Historical Delta (vs v<N-1>) *(If Applicable)*
- ✅ **Resolved**: ...
- ⚠️ **New Risks Introduced**: ...
- 📊 **Architecture Shift**: ...

---

## 6. Detailed & Granular Action Plan (Miêu tả chi tiết những gì sẽ làm)

### Phase 1: Chuẩn bị & Validate môi trường
- [ ] **File**: `path/to/file.ts`
  - **Mô tả chi tiết**: ...
  - **Code signature / Interface**:
    ```typescript
    // Type definitions hoặc contract
    ```

### Phase 2: Triển khai Core Logic
- [ ] **File**: `path/to/file.ts`
  - **Logic xử lý chi tiết**: ...
  - **Code mẫu / Implementation draft**:
    ```typescript
    // Code chi tiết các bước xử lý
    ```

### Phase 3: Xử lý Edge Cases & Guard Clauses
- [ ] **File**: `path/to/file.ts`
  - **Các trường hợp chặn lỗi**: Null check, timeout, retry, fallback...

### Phase 4: Kiểm thử tự động & Benchmark
- [ ] **File**: `tests/path/to/test.ts`
  - **Test cases cần viết**: Unit test, race condition simulation, integration test...
```
