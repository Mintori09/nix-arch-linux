# AI Agent & Developer Guidelines (AGENTS.md)

Welcome! This document provides context, architectural constraints, and code style rules for AI assistants, agents, and developers working on the `cv-cli` project. Read this before modifying or generating code.

---

## 1. Project Overview & Architecture

`cv-cli` is a modular, zero-heavy-dependency CLI file format converter built on top of the **Bun/TypeScript** runtime. Instead of relying on bloated Node modules (like Puppeteer), it orchestrates local system binaries (`ffmpeg`, `pandoc`, `chromium`, etc.) using explicit, low-level process spawning and protocols.

### Directory Structure & Responsibilities

```text
src/
├── core/
│   ├── command.ts       # Low-level process spawning (spawn), shell escaping, output capture
│   └── chromium.ts      # Low-level Chrome DevTools Protocol (CDP) via native WebSockets
├── converters/
│   ├── index.ts         # Type exports + high-order factory wrappers (ffmpeg, pandoc, yq, etc.)
│   └── document.ts      # Specialized multi-stage pipelines (e.g., Markdown-to-PDF)
├── ui/
│   └── spinner.ts       # TTY-aware, non-flickering CLI animation wrapper
├── errors.ts            # Centralized custom error classes (CliError, CommandExecutionError)
├── routes.ts            # The Single Source of Truth routing map (Format Pairs -> Converter)
├── utils.ts             # Shared helpers (args, sleep, isMain)
├── cv.ts                # App orchestrator (CLI parsing, validation, bootstrapping flow)
└── index.ts             # Entrypoint with shebang, imports cv.ts and invokes run()
```

### Dependency Map

| Module                   | Depends On                                         |
| ------------------------ | -------------------------------------------------- |
| `errors.ts`              | _(none)_                                           |
| `utils.ts`               | _(none)_                                           |
| `core/command.ts`        | `errors.ts`                                        |
| `core/chromium.ts`       | `errors.ts`, `utils.ts`, `core/command.ts`         |
| `ui/spinner.ts`          | `converters/index.ts` (type: `ConvertContext`)     |
| `converters/index.ts`    | `core/command.ts`, `core/chromium.ts`, `errors.ts` |
| `converters/document.ts` | `converters/index.ts`                              |
| `routes.ts`              | `converters/index.ts`                              |
| `cv.ts`                  | all modules above                                  |
| `index.ts`               | `cv.ts`                                            |

---

## 2. Strict Code Style & Guardrails

To maintain the project's **Clean Code** and minimal-overhead standards, all generated code must strictly comply with the following rules:

- **No Emojis / Decorative Elements:** Do not output emojis, ASCII art, or decorative signatures in logs, terminal outputs, error messages, or code comments. Keep all strings professional, scannable, and clean.
- **No Bloated NPM Dependencies:** Do not introduce heavy wrapper libraries (e.g., `shelljs`, `puppeteer`, `fluent-ffmpeg`). Use native `node:child_process` (`spawn`) or modern web APIs built into Bun/Node (like native `WebSocket` for CDP connection) via the wrappers in `src/core/`.
- **Explicit System Module Imports:** Always prefix built-in Node.js modules with `node:` (e.g., `import path from "node:path";`, `import { spawn } from "node:child_process";`).
- **Strong Typing:** Maintain strict TypeScript safety. Avoid `any` types. Leverage `readonly string[]` for process arguments to enforce immutability.
- **Test-Driven Development:** Prioritize the Red-Green-Refactor cycle — write failing tests first, then implement, then refactor. All new features and bug fixes require corresponding tests.
- **Typecheck** : Run `pnpm typecheck` every write complete.

---

## 3. Core Engine Contracts

### Process Spawning (`src/core/command.ts`)

- Always use `runCommand(parts: readonly string[], options?: CommandOptions)` instead of importing `spawn` directly into high-level features.
- Ensure all shell logging safely respects `options.dryRun` by only outputting a `YELLOW` tokenized log string without running the actual binary.

### Chromium CDP Automation (`src/core/chromium.ts`)

- The custom CDP implementation directly orchestrates target sessions over WebSockets.
- When executing page snapshots, you must maintain the strict lifecycle order: launch headless -> sniff dynamic port from `stderr` -> open WebSocket -> await `document.readyState === "complete"` -> await `document.fonts.ready` -> calculate layouts -> override viewport via `Emulation.setDeviceMetricsOverride` -> snapshot.
- **Always** wrap the workspace profile directory teardown inside a standard `finally` block to prevent leaving dangling `/tmp/cv-chromium-` folders.

---

## 4. How to Extend the Application

### Adding a New Tool Wrapper

1. Open `src/converters/index.ts`.
2. Define a clean factory function returning a `ToolConverter` instance — ensure it forwards `context.passthroughArgs`:

```typescript
export function newToolWrapper(
  extraArgs: readonly string[] = [],
): ToolConverter {
  return {
    tool: "tool-binary-name",
    convert: (input, output, context) =>
      runCommand(
        [
          "tool-binary-name",
          ...extraArgs,
          ...context.passthroughArgs,
          input,
          output,
        ],
        {
          dryRun: context.dryRun,
        },
      ).then(() => undefined),
  };
}
```

The core engine automatically passes trailing CLI arguments as `context.passthroughArgs`, enabling arbitrary tool flags without explicit CLI registration.

### Registering a Route

1. Open `src/routes.ts`.
2. Add your format transition mapping directly to the `ROUTES` object constant:

```typescript
export const ROUTES: Record<string, ToolConverter> = {
  // ... existing routes
  "abc:xyz": newToolWrapper(["--optimize"]),
};
```

3. The core engine will automatically handle path verification, system dependency checks via `which`, and loading animations.

### Zsh Completion

The `completions/_cv` file provides tab completion for all flags (`--dry-run`, `--style`, `--reference-doc`, `--metadata-file`, `--toc`/`--no-toc`, `--number-sections`/`--no-number-sections`, `--wrap`, `--extract-media`) and file arguments.

**Install:**

```sh
mkdir -p ~/.zsh/completions
cp completions/_cv ~/.zsh/completions/
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
exec zsh
```

For Nix users, add the fpath line to `shellHook` in `flake.nix`.
