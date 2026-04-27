# Repository Guidelines

## Project Structure & Module Organization

`mdview` is a small Go application with a web UI. The CLI entrypoint lives in `cmd/mdview`. Core runtime and input handling are in `internal/app`, HTTP handlers and rendering are in `internal/server`, document loading and file discovery are in `internal/document`, and persisted settings are in `internal/config`. Embedded frontend assets live under `internal/assets/web`, with browser helpers in `internal/browser` and shared session state in `internal/session`.

Go tests sit beside the packages they cover as `*_test.go`. Browser-side tests live in `internal/assets/web` as `*.test.mjs`.

## Build, Test, and Development Commands

Use the repo root for all commands.

- `go run ./cmd/mdview -h` shows CLI flags and local runtime options.

- `go run ./cmd/mdview README.md` starts the local viewer against a file.

- `go test ./...` runs the Go unit test suite across all packages.

- `node --test internal/assets/web/*.test.mjs` runs the frontend logic tests.

- `gofmt -w cmd/mdview internal/...` formats changed Go files before review.

## Coding Style & Naming Conventions

Follow standard Go formatting with `gofmt`; use tabs as emitted by the formatter, lowercase package names, and PascalCase for exported identifiers. Keep package responsibilities narrow and prefer extending existing internal packages over adding new top-level directories.

For web assets, match the existing plain ES module style in `internal/assets/web`. Keep filenames descriptive and aligned with behavior, such as `app-state.js` and `app-state.test.mjs`.

## Testing Guidelines

Add or update tests in the same package as the change. Prefer table-driven Go tests when validating multiple input cases. When changing editor behavior, rendering, or client state, run both `go test ./...` and `node --test internal/assets/web/*.test.mjs`.

## Commit & Pull Request Guidelines

Recent history uses scoped Conventional Commit-style subjects such as `feat(mdview): ...`, `docs(mdview): ...`, `refactor(mdview): ...`, and `style(mdview): ...`. Keep subjects imperative and specific.

PRs should summarize the user-visible change, note test coverage, and include screenshots or short recordings for UI updates.

## Security & Configuration Tips

The local server binds to `127.0.0.1`. Write endpoints are token-protected by default; do not disable that behavior casually with `-no-token`.VimProbehjklviaoxdu0$O