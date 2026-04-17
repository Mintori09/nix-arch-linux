---
name: memory-aware-architect
description: Mandatory persistent memory integration for project development. Use when working on any codebase that uses opencode-mem for context persistence. Always searches memory before planning, coding, refactoring, or debugging. Suggests adding new facts after completing significant tasks. Works with any programming language, framework, or architecture style.
license: MIT
---

# Memory-Aware Architect

## Core Workflow (Mandatory)

### 1. Search Memory First (Required at Task Start)

Before responding to any architecture, refactoring, feature implementation, debugging, or project-related query, execute one or more semantic searches in persistent memory using the `memory` tool.

Craft specific, descriptive queries based on the user's task and the project context:

```javascript
// Architecture & design patterns
memory({
  mode: "search",
  query: "architecture pattern layers components structure",
});

// Technology stack & frameworks
memory({ mode: "search", query: "framework library dependencies tech stack" });

// Error handling & logging
memory({ mode: "search", query: "error handling logging monitoring patterns" });

// Testing strategy
memory({ mode: "search", query: "testing unit integration e2e test patterns" });

// Specific features or modules
memory({ mode: "search", query: "authentication user management JWT session" });
memory({ mode: "search", query: "database schema models relationships ORM" });
memory({ mode: "search", query: "API endpoints routes controllers handlers" });
```

**Key principles for effective searches:**

- Include relevant technical terms from the user's request
- Search for both broad patterns and specific implementations
- When user mentions modules/components/features, include those exact terms
- Run multiple searches if the task involves different aspects (e.g., frontend + backend + database)

### 2. Integrate Retrieved Facts

- Use retrieved memories to inform all planning, reasoning, and code generation
- Never re-explain concepts, patterns, or decisions already stored in memory
- Trust the existing memory over assumptions—the project has its own conventions
- If critical context is missing, ask for clarification—but prioritize existing memory content
- If no relevant memories found, mention: "No prior context found in memory for [topic]"

### 3. Add New Knowledge (After Significant Work)

After completing important tasks (refactors, new features, architectural decisions, significant fixes), identify valuable new knowledge and suggest adding it to memory:

```javascript
memory({
  mode: "add",
  content: "[concise, precise description of new decision/implementation]",
});
```

**What makes good memory content:**

- Architectural decisions and their rationale
- Established patterns and conventions
- Technology choices and configuration details
- Non-obvious implementation details
- Gotchas, edge cases, or lessons learned
- Integration patterns between components
- Performance optimizations applied

**Examples across different project types:**

```javascript
// Frontend project
memory({
  mode: "add",
  content:
    "Use React.memo() for all list item components to prevent unnecessary re-renders; measured 40% performance improvement",
});

// Backend API
memory({
  mode: "add",
  content:
    "All API endpoints use middleware chain: auth → rate-limit → validation → controller; defined in src/middleware/index.js",
});

// Database
memory({
  mode: "add",
  content:
    "User sessions table uses UUID v4 for session_id with 24-hour TTL; cleanup cron runs daily at 3 AM UTC",
});

// DevOps
memory({
  mode: "add",
  content:
    "Deploy staging with 'npm run deploy:staging'; auto-runs migrations and health checks before traffic switch",
});

// Architecture decision
memory({
  mode: "add",
  content:
    "Switched from REST to GraphQL for mobile API to reduce over-fetching; web still uses REST for caching benefits",
});
```

## Universal Best Practices

These guidelines apply regardless of project type, but always defer to project-specific patterns stored in memory:

### Memory-First Mindset

- **Always search before assuming** - The project may have established conventions
- **Consistency over cleverness** - Follow existing patterns even if you'd do it differently
- **Document decisions, not just code** - Future you (or Claude) needs to understand _why_

### What to Search For

- Project structure and organization
- Naming conventions (files, functions, variables, classes)
- Error handling and logging patterns
- Testing approaches and tools
- Code style preferences (formatting, comments, documentation)
- Dependency management and versions
- Build and deployment processes
- Third-party integrations and API patterns

### What to Add to Memory

- Deviations from framework defaults
- Performance optimizations
- Security considerations
- Cross-cutting concerns (auth, logging, caching, etc.)
- Module/component responsibilities
- Data flow and state management
- Configuration and environment setup
- Team conventions and preferences

## Example Usage Patterns

### User: "Add user authentication to the app"

**Correct Response Flow:**

1. Search memory: "authentication", "user management", "security patterns", "session handling"
2. Check what auth approach is already established (JWT? Sessions? OAuth?)
3. Apply existing security patterns from memory
4. Implement following project conventions
5. Suggest adding: "Implemented JWT authentication with refresh tokens; access token TTL 15min, refresh TTL 7 days; stored in httpOnly cookies"

### User: "Fix the bug where the dashboard loads slowly"

**Correct Response Flow:**

1. Search memory: "dashboard", "performance", "loading", "caching", "data fetching"
2. Identify existing performance patterns or known issues from memory
3. Debug using project-specific context
4. If you find and fix a non-obvious issue, suggest adding: "Dashboard slow load caused by N+1 query in user stats endpoint; fixed with single JOIN query and added Redis cache (5min TTL)"

### User: "Refactor the payment module to be more testable"

**Correct Response Flow:**

1. Search memory: "payment", "testing patterns", "dependency injection", "mocking"
2. Apply project's established testing and architecture patterns
3. Refactor maintaining consistency with existing code structure
4. Suggest adding: "Refactored PaymentService to use dependency injection; accepts payment gateway as constructor param for easier mocking in tests"

## Anti-Patterns to Avoid

- ❌ Skipping the initial memory search (breaks continuity)
- ❌ Re-explaining concepts already in memory (wastes tokens)
- ❌ Ignoring retrieved patterns when generating code (creates inconsistency)
- ❌ Forgetting to suggest memory additions after significant work (loses knowledge)
- ❌ Assuming standard conventions without checking memory first (may conflict with project)
- ❌ Adding trivial or obvious information to memory (noise)
- ❌ Writing vague memory content like "implemented feature X" (not useful later)

## Quick Reference

**When to Search Memory:**

- Start of any development task
- Before making architectural decisions
- When encountering unfamiliar parts of codebase
- Before refactoring existing code
- When debugging issues
- When adding new features or modules

**When to Add to Memory:**

- After implementing significant features
- When making architectural decisions
- After fixing non-trivial bugs
- When establishing new patterns or conventions
- After performance optimizations
- When integrating external services
- After learning project-specific gotchas

**Default Response Flow:**

```
1. memory search (1+ queries based on task)
   ↓
2. analyze retrieved facts and patterns
   ↓
3. generate solution consistent with project
   ↓
4. suggest memory add for new knowledge (if applicable)
```

**Search Query Formula:**

```
[feature/module name] + [technical aspect] + [related patterns]

Examples:
- "user profile component React state management"
- "payment processing error handling retry logic"
- "database migration rollback strategy"
```
