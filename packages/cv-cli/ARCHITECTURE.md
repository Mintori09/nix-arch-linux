# TECHNICAL SPECIFICATION: CLI FORMAT CONVERTER REFACTORING

## 1. Goals & Scope

### 1.1 Goals

- **Separation of Concerns:** Deconstruct the current monolithic `cv.ts` into specialized modules, ensuring each module has a single responsibility (CLI parsing, process spawning, DevTools connection, format routing).
- **Extensibility:** Allow seamless integration of new file formats or system CLI tools without altering the core execution pipeline.
- **Testability:** Isolate core processing and mapping logic from direct I/O or process spawning to enable clean unit testing.
- **Behavioral Parity:** Maintain exact feature parity with the current tool (including dry-runs, dynamic spinners, passthrough arguments, automated Chromium viewport calculation, and stdout/stderr capture).

### 1.2 Architectural Scope

The project will be refactored into a modular package running on the Bun/TypeScript runtime, structured as follows:

```text
src/
├── core/
│   ├── command.ts       # Process spawning, shell escaping, and output formatting
│   └── chromium.ts      # Low-level DevTools Protocol abstraction & full-page screenshots
├── converters/
│   ├── index.ts         # Type exports + factory wrappers (ffmpeg, pandoc, libreoffice, yq, etc.)
│   ├── document.ts      # Specialized conversion pipelines (e.g., mdToPdf with fallback CSS)
│   └── mermaid.ts       # Mermaid auto-detection and mmdr preprocessing to data URI
├── ui/
│   └── spinner.ts       # Terminal TTY-aware state and loading animation management
├── config.ts            # Style alias loading, alias resolution, file resolution, cv init
├── errors.ts            # Centralized custom exception definitions
├── routes.ts            # Declarative routing map (Format Pair -> Converter Factory)
├── utils.ts             # Shared helpers (args, sleep, isMain)
├── cv.ts                # App orchestrator (CLI parsing, validation, bootstrapping flow)
└── index.ts             # Entrypoint with shebang, imports cv.ts and invokes run()

```

---

## 2. Detailed Module Design

### 2.1 Exception Handling Layer (`src/errors.ts`)

Centralizes error definitions to provide clean, unified try-catch handling at the bootstrap entrypoint.

- `CliError`: Raised on user input validation failures, missing files, or absent system dependencies. Supports custom exit codes.
- `CommandExecutionError`: Raised when an underlying spawned process exits with a non-zero code. Captures the compiled `command`, truncated `stderr`, and the process `exitCode`.

### 2.2 Terminal UI Layer (`src/ui/spinner.ts`)

Extracts terminal animation logic out of the main conversion flow to eliminate asynchronous rendering noise.

- **Helper:** `shouldEnableSpinner(options: { dryRun: boolean, isTTY?: boolean }): boolean`
- **Wrapper:** `withSpinner<T>(context: ConvertContext, task: () => Promise<T>): Promise<T>`
- Implements a `300ms` initialization delay (`setTimeout`) to prevent visual flickering on instantaneous tasks.

### 2.3 Process Spawning Engine (`src/core/command.ts`)

- `shellEscape(value: string): string`: Sanitizes arbitrary string segments into safe shell-escaped tokens for clean terminal logging.
- `formatCommand(parts: readonly string[]): string`: Composes an array of command arguments into a single printable string.
- `shortStderr(stderr: string, maxLines?: number, maxChars?: number): string`: Truncates massive log buffers down to a readable terminal summary.
- `runCommand(parts: readonly string[], options?: CommandOptions): Promise<string>`:
- If `options.dryRun` is enabled, skips execution, logs the command token to stdout using a `YELLOW` color wrapper, and returns an empty string.
- Pipes standard I/O channels correctly and handles lifecycle events via Promises.

### 2.4 Headless Chromium CDP Interface (`src/core/chromium.ts`)

Encapsulates low-level communication with Google Chrome via the Chrome DevTools Protocol (CDP) using standard WebSockets.

- `class DevToolsSession`: Coordinates asynchronous message routing to Chrome over a persistent connection. Resolves incoming payloads using an atomic incrementing integer ID (`nextId`).
- `waitForDevToolsPort(stream: NodeJS.ReadableStream): Promise<number>`: Scans Chrome's `stderr` stream via Regular Expressions to extract the dynamic ephemeral port bound by `--remote-debugging-port=0`.
- `captureMhtmlScreenshot(input: string, output: string, context: ConvertContext): Promise<void>`:
- Provisions an isolated user data directory using `mkdtemp(path.join(tmpdir(), "cv-chromium-"))`.
- Sequences state via CDP: Executes `Page.enable`, blocks until `document.readyState === "complete"`, and awaits `document.fonts.ready`.
- Computes actual document bounds via `Page.getLayoutMetrics` and feeds them into `calculateViewportSize`.
- Overrides layout constraints using `Emulation.setDeviceMetricsOverride` to guarantee a crisp full-page render without clipping or scrollbars before executing `Page.captureScreenshot`.
- Assures rigorous environment cleanup of the temporary profile directory within a structural `finally` block.

### 2.5 Converters Registry (`src/converters/`)

#### `src/converters/index.ts` (Factory Functions)

Exposes consistent high-order wrappers returning structural `ToolConverter` shapes. All converters receive `context.passthroughArgs` — any user-supplied flags after positional arguments — and forward them to the underlying binary. This allows arbitrary configuration without adding explicit CLI flags for every option:

```text
cv input.md output.html --standalone --toc --katex
                     ↑ positional separator
                                       ↑ passthrough → pandoc
```

- `ffmpeg(args)`: Maps media mutations. Forwards passthrough after built-in args.
- `imageMagick(extraArgs)`: Handles raster and vector asset processing. Forwards passthrough.
- `libreOffice(outExt)`: Converts complex office suites via headless `soffice`. Calculates target output filenames generated inside the working path and invokes an atomic file `rename` to match user expectations. Forwards passthrough.
- `pandoc(options)`: Multi-format document converter. Forwards `passthroughArgs` and `--metadata-file` globally. The `--reference-doc` flag injects `--reference-doc=<file.docx>` when targeting DOCX for style templates. `--toc` injects `--toc`. `--number-sections` injects `--number-sections`. `--wrap` injects `--wrap=none|preserve`. `--extract-media` injects `--extract-media=<path>`; defaults to `<output>_media/` when source is docx or md and no path given. `--page-size` injects `-V papersize:<val>` for PDF output.
- `xlsx2csvConverter()`, `yq(inputFormat, outputFormat)`, `pdfToImage(kind, outputExt)`.

#### `src/converters/document.ts` (Specialized Logic)

- `mdToPdf()`: Contains standalone document formatting logic. Shorthand for `pandoc({from:"markdown", to:"pdf"})` with `--pdf-engine=weasyprint`, `--highlight-style=tango`, and `-V geometry:margin=2cm`. Falls back to a bundled `style.css` when no user style is set.

#### `src/converters/mermaid.ts` (Mermaid Preprocessing)

- `hasMermaidBlocks(content: string): boolean`: Scans text for ` ```mermaid ` fenced code blocks via regex.
- `tryPreprocessMermaid(content: string, context: { dryRun: boolean }): Promise<string>`: If mermaid blocks are detected, spawns `mmdr` (mermaid-cli) to render each block to SVG, base64-encodes it, and replaces the fenced block with a `![](data:image/svg+xml;base64,...)` data URI. Returns the original content unchanged on dry-run, when mmdr is missing from PATH, or when no mermaid blocks are found.

### 2.6 Shared Utilities (`src/utils.ts`)

Provides small helpers shared across the orchestrator layer:

- `const args: string[]` — `process.argv.slice(2)` for `parseArgs` input.
- `function sleep(ms: number): Promise<void>` — Promise-based delay wrapper.
- `function isMain(metaUrl: string): boolean` — Checks if the current module is the entrypoint by comparing `fileURLToPath(metaUrl)` against `process.argv[1]`.

### 2.7 Config & Initialization (`src/config.ts`)

Handles style alias configuration and the `cv init` command:

- `CONFIG_DIR`, `CONFIG_PATH`: constants pointing to `~/.config/convert-file/config.json`.
- `loadStyleConfig(configDir?)`: Reads config.json and returns the `styles` map (`Record<string, string>`) — alias → absolute CSS path. Returns `{}` on missing/invalid config.
- `resolveAlias(style, aliases)`: Looks up `style` in the aliases map. Returns the mapped absolute path or `null`.
- `resolveStylePath(style)`: Resolves a CSS path to an existing file on disk. Handles `~` expansion, absolute paths, and CWD-relative paths. Returns `null` if no file found.
- `cmdInit()`: Creates `~/.config/convert-file/` + `styles/` + `config.json` (`{}`). Triggered by `cv init` positional subcommand.

Config JSON schema:

```json
{
  "styles": {
    "blog": "/home/user/.config/convert-file/styles/blog.css",
    "dark": "~/.config/convert-file/styles/dark.css"
  }
}
```

### 2.8 Entrypoint Layer (`src/index.ts`)

A thin shebang file (`#!/usr/bin/env tsx`) that imports `run()` from `cv.ts` and invokes it:

```typescript
#!/usr/bin/env tsx
import { run } from "./cv.js";
await run();
```

Exists solely to give the CLI a clean user-facing entrypoint. All business logic lives in `cv.ts`.

### 2.9 Routing Configuration (`src/routes.ts`)

Acts as the single source of truth defining the global `ROUTES` constant typed against `Record<string, ToolConverter>`. To introduce a new conversion pipe, developers only need to declare a single key-value entry here.

### 2.10 Module Dependency Map

| Module                       | Depends On                                                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/errors.ts`              | _(none)_                                                                                                                                                                                      |
| `src/utils.ts`               | _(none)_                                                                                                                                                                                      |
| `src/core/command.ts`        | `src/errors.ts`                                                                                                                                                                               |
| `src/core/chromium.ts`       | `src/errors.ts`, `src/utils.ts`, `src/core/command.ts`                                                                                                                                        |
| `src/ui/spinner.ts`          | `src/converters/index.ts` (type: `ConvertContext`)                                                                                                                                            |
| `src/config.ts`              | `node:path`, `node:os`, `node:fs`                                                                                                                                                             |
| `src/converters/index.ts`    | `src/core/command.ts`, `src/core/chromium.ts`, `src/errors.ts`, `src/config.ts`                                                                                                               |
| `src/converters/document.ts` | `src/converters/index.ts`                                                                                                                                                                     |
| `src/converters/mermaid.ts`  | `src/core/command.ts`                                                                                                                                                                         |
| `src/routes.ts`              | `src/converters/index.ts`                                                                                                                                                                     |
| `src/cv.ts`                  | `src/utils.ts`, `src/errors.ts`, `src/config.ts`, `src/ui/spinner.ts`, `src/core/command.ts`, `src/core/chromium.ts`, `src/converters/index.ts`, `src/converters/mermaid.ts`, `src/routes.ts` |
| `src/index.ts`               | `src/cv.ts`                                                                                                                                                                                   |

All dependencies flow bottom-to-top. No circular imports.

### 2.11 CLI Flags Reference

| Flag                                         | Type    | Description                                                                                                                                 | Affected routes                                                               |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `--dry-run`                                  | boolean | Simulate without running tools                                                                                                              | all                                                                           |
| `--list`                                     | boolean | Print supported conversions                                                                                                                 | —                                                                             |
| `--help` / `-h`                              | boolean | Show usage                                                                                                                                  | —                                                                             |
| `--style=<file\|alias>`                      | string  | CSS file, alias (from config), or `~` path. Alias resolved via `config.json` `styles` map, then `resolveStylePath` for filesystem fallback. | All pandoc routes                                                             |
| `--reference-doc=<file>`                     | string  | DOCX style template                                                                                                                         | `md:docx`                                                                     |
| `--metadata-file=<file>`                     | string  | Pandoc metadata variables                                                                                                                   | `md:docx`, `md:html`, `md:epub`, `md:pdf`, `docx:md`, `docx:html`, `docx:txt` |
| `--toc` / `--no-toc`                         | boolean | Generate table of contents                                                                                                                  | `md:docx`, `md:html`, `md:epub`, `md:pdf`                                     |
| `--number-sections` / `--no-number-sections` | boolean | Number section headings                                                                                                                     | `md:docx`, `md:html`, `md:epub`, `md:pdf`                                     |
| `--wrap=<mode>`                              | string  | Text wrapping (`none` / `preserve`)                                                                                                         | `docx:txt`, `docx:md`, `html:md`, `txt:md`, `rst:md`                          |
| `--extract-media=<dir>`                      | string  | Extract media to directory (default: `<output>_media/`)                                                                                     | `doc:md`, `docx:md`, `docx:html`, `md:docx`, `md:html`, `md:epub`             |
| `--page-size=<size>`                         | string  | Page size for PDF output (`a3`/`a4`/`a5`/`letter`/`legal`)                                                                                  | `md:pdf`                                                                      |

**Subcommands:**

| Command | Description                                                                      |
| ------- | -------------------------------------------------------------------------------- |
| `init`  | Create `~/.config/convert-file/config.json` + `styles/` dir for first-time setup |

---

## 3. Data Flow

The lifecyle of an active file conversion command processes through the following sequence:

1. **CLI Invocation:** The user triggers the script via the shell interpreter.
2. **Subcommand Early Exit:** If the first positional is `"init"`, delegates to `cmdInit()` to scaffold `~/.config/convert-file/` and returns immediately.
3. **Argument Parsing:** `src/index.ts` (shebang) delegates to `cv.ts`, which evaluates CLI space boundaries via `parseArgs`, separating positional inputs (`input`, `output`, `passthroughArgs`) from active configuration flags (`--dry-run`, `--style`, `--reference-doc`, `--metadata-file`, `--toc`/`--no-toc`, `--number-sections`/`--no-number-sections`, `--wrap`, `--extract-media`, `--page-size`). String-typed flags (`--style`, `--reference-doc`, `--metadata-file`, `--extract-media`) accept file paths; `--wrap` validates against allowed values `none` or `preserve`.
4. **Style Alias Resolution:** If `--style` is set, `cv.ts` loads `config.json` via `loadStyleConfig()` and checks if the value matches an alias key. If so, replaces the value with the mapped absolute path. `~` expansion in alias values is handled by `resolveStylePath` before passing to pandoc.
5. **Sanity Validation:**

- Confirms file presence via `access` (`pathExists`).
- Parses source/target format extensions via `extensionOf`.
- Matches the compiled route token (`inExt:outExt`) against the registered `ROUTES` table.

6. **Mermaid Preprocessing:** If the input is `.md`/`.markdown` and contains fenced ` ```mermaid ` code blocks, `tryPreprocessMermaid()` spawns `mmdr` to render each block to SVG, then replaces it with a base64 data URI. The modified content is written to a temp file which is used as the conversion input. Temp dir is cleaned up in `finally`.
7. **Dependency Assertions:** Dispatches system execution checks via `which <tool_name>` to verify that binary runtimes reside inside the active `$PATH`. This check is safely bypassed during `--dry-run` modes.
8. **Directory Provisioning:** Automatically creates the missing destination directory tree recursively via `mkdir(..., { recursive: true })`.
9. **UI-Bounded Execution:** Wraps operational execution inside a standard `withSpinner` context and fires the matched route's `convert()` callback.
10. **Error Handling & Teardown:** Catches operational anomalies, formats detailed stack traces to `stderr`, and forces predictable exits via `process.exit(1)`.
