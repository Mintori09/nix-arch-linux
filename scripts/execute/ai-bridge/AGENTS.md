# AI Bridge — Agent Guide

## Quick start

- **Run daemon**: `pnpm server` (builds then runs foreground on `127.0.0.1:58721`)
- **Run tests**: `pnpm test` (vitest)
- **Typecheck**: `pnpm typecheck` (tsc --noEmit on root + userscript)
- **Full build**: `pnpm build` (bun build daemon + node build.mjs userscript)
- **Package manager**: pnpm (v11.5+, monorepo via pnpm-workspace.yaml)

## Architecture

- **Daemon** (`src/daemon/server.ts`): HTTP server on port 58721, pure Node.js `http.createServer()`, zero framework deps. Routes in `src/daemon/routes/`.
- **CLI** (`src/cli/index.ts`): Thin HTTP client, reads stdin/args, sends to daemon, exits. Commands in `src/cli/commands/`.
- **Userscript** (`userscript/`): Tampermonkey script. Build: `build.mjs` concatenates `src/*.js` (sorted, main.js last) + inlines `templates/` as JS string vars → single `dist/ai-bridge.user.js`.
- **Config** (`src/config.ts`): Env vars `DAEMON_HOST` (default `127.0.0.1`) and `AI_BRIDGE_PORT` (default `58721`).

## Key quirks

- Two different `resolveFilename` implementations:
  - `src/utils.ts` — simple lowercase/hyphen/sanitize
  - `userscript/src/core/panel.js` — NFD Unicode normalization + diacritic stripping for Vietnamese
- `tsx` is a **runtime** dependency (not dev) — the CLI/daemon run `.ts` files directly via `tsx` (shebang `#!/usr/bin/env tsx` in `src/cli/index.ts`)
- Build uses **bun** for the daemon binary (`bun build src/cli/index.ts --target=node`), not `tsc` or `esbuild` directly
- System deps for clipboard: `wl-paste` (Wayland), `xclip` (X11). For browser: `xdg-open`, `kdotool`. Missing tools return 501, daemon doesn't crash.
- Default title is `"Prompt"` — set in `routes/enqueue.ts`, but NOT in `routes/clipboard.ts` (passes `undefined` → queue stores `""`)
- Integration tests (`tests/daemon/routes.test.ts`) start a real HTTP server on port 0, test against live endpoints
- Daemon lifecycle: `ai-bridge server` checks `/health` before starting (rejects if already running); `ai-bridge stop` polls `/health` with 5s timeout

## Code conventions

- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters`
- ESM (`"type": "module"`)
- Node.js built-in `http` module for server; no Express/body-parser/CORS libs — all hand-rolled
- Route handlers use explicit dependency injection: queue, openBrowser, focusBrowser, readClipboard are passed as params (not imported)
- Userscript: vanilla JS (no bundler/transpiler), GM\_\* APIs, `@run-at document-idle`
- Test files adjacent to source in `tests/`, follow source directory structure
