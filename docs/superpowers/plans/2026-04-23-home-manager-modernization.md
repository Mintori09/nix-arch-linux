# Home Manager Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize and refactor the Home Manager codebase in small reviewable passes while preserving current behavior and keeping public module APIs stable.

**Architecture:** The refactor proceeds in parity-first passes. Start by recording the current module graph and validation commands, then remove confirmed dead code, normalize module boundaries, extract shared helpers for script wrappers and constants, split oversized modules into focused internal files, and finally consolidate duplicated package declarations without changing exposed commands or Home Manager outputs.

**Tech Stack:** Nix flakes, Home Manager, nixGL, spicetify-nix, Bun, Bash, Python

---

### Task 1: Create Baseline Docs And Parity Harness

**Files:**
- Create: `docs/refactor/module-map.md`
- Create: `docs/refactor/parity-checklist.md`
- Create: `docs/refactor/dead-code-candidates.md`
- Modify: `README.md`

- [ ] **Step 1: Write the baseline module map**

Document the current ownership boundaries before changing code.

```markdown
# Module Map

## Top-level entrypoints
- `flake.nix`: defines `homeConfigurations.mintori`
- `home.nix`: imports `./modules` and `./modules/packages.nix`
- `modules/default.nix`: imports `programs`, `shell`, `scripts`, `zsh_function.nix`, `secrets.nix`

## Shell
- `modules/shell/default.nix`: active shell import entrypoint
- `modules/shell/zsh.nix`: active zsh plugins and init content
- `modules/shell/alias.nix`: aliases
- `modules/shell/environment.nix`: session variables and session path
- `modules/shell.nix`: suspected stale predecessor, not imported by `modules/default.nix`

## Scripts
- `modules/scripts/*.nix`: wrappers that expose commands from `scripts/execute/*`
- `scripts/execute/*`: runtime implementation for commands

## Large program modules
- `modules/programs/helix/default.nix`
- `modules/programs/opencode/default.nix`
- `modules/programs/kitty.nix`
- `modules/programs/alacritty.nix`
```

- [ ] **Step 2: Write the parity checklist**

Capture the exact commands that must keep working through each pass.

```markdown
# Parity Checklist

## Build
- `home-manager build --flake .#mintori`

## Custom commands
- `command -v format`
- `command -v wf`
- `command -v ifont`
- `command -v irpm`
- `command -v cpath`
- `command -v preview`
- `command -v rgf`

## Wrapped applications
- `command -v hx`
- `command -v opencode`
- `command -v kitty`
- `command -v alacritty`

## Generated config
- confirm generated `helix/config.toml`
- confirm generated `helix/languages.toml`
- confirm generated `opencode/config.json`
- confirm generated zsh init still contains aliases, plugin setup, and custom completions
```

- [ ] **Step 3: Write the dead-code candidate list**

Start with evidence-backed candidates only.

```markdown
# Dead Code Candidates

## Candidate 1: `modules/shell.nix`
Current behavior:
- Defines a full `programs.zsh` configuration.
- Appears stale because `modules/default.nix` imports `./shell` directory, not `./shell.nix`.

Structural improvement:
- Delete after import graph and build confirm it is unused.

Validation:
- `rg -n "shell\\.nix|\\./shell" modules home.nix`
- `home-manager build --flake .#mintori`
```

- [ ] **Step 4: Update README to describe the refactor safety process**

Add a short section that points maintainers to the refactor docs instead of silently changing structure.

```markdown
## Refactor Safety

Before structural cleanup, use the docs in `docs/refactor/`:

- `module-map.md` for module ownership
- `parity-checklist.md` for behavior-preserving validation
- `dead-code-candidates.md` for evidence-backed deletions
```

- [ ] **Step 5: Run baseline validation**

Run: `home-manager build --flake .#mintori`
Expected: build succeeds before any structural code cleanup starts

- [ ] **Step 6: Commit**

```bash
git add README.md docs/refactor/module-map.md docs/refactor/parity-checklist.md docs/refactor/dead-code-candidates.md
git commit -m "docs: add refactor baseline and parity checklist"
```

### Task 2: Remove Confirmed Dead Shell Module

**Files:**
- Modify: `docs/refactor/dead-code-candidates.md`
- Delete: `modules/shell.nix`
- Test: `modules/default.nix`

- [ ] **Step 1: Verify the stale shell module is not imported**

Run: `rg -n "shell\\.nix|\\./shell" modules home.nix`
Expected: only `./shell` directory import is active from `modules/default.nix`, and no path points to `modules/shell.nix`

- [ ] **Step 2: Record the current behavior and deletion rationale**

Update `docs/refactor/dead-code-candidates.md` with:

```markdown
## Candidate 1: `modules/shell.nix`
Current behavior:
- Not imported by the top-level module graph.
- Active shell behavior comes from `modules/shell/default.nix`, `modules/shell/zsh.nix`, `modules/shell/alias.nix`, and `modules/shell/environment.nix`.

Structural improvement:
- Remove the stale duplicate module to eliminate confusion over which zsh configuration is live.

Validation:
- `home-manager build --flake .#mintori`
```

- [ ] **Step 3: Delete the stale module**

Delete `modules/shell.nix`.

- [ ] **Step 4: Run validation**

Run: `home-manager build --flake .#mintori`
Expected: build still succeeds because no active imports relied on `modules/shell.nix`

- [ ] **Step 5: Commit**

```bash
git add docs/refactor/dead-code-candidates.md modules/shell.nix
git commit -m "refactor: remove stale shell module"
```

### Task 3: Normalize Module Boundaries Without Changing Options

**Files:**
- Create: `modules/programs/qutebrowser.nix`
- Modify: `modules/programs/default.nix`
- Modify: `modules/scripts/default.nix`
- Delete: `modules/scripts/qutebrowser.nix`

- [ ] **Step 1: Move qutebrowser into the programs module group**

Create `modules/programs/qutebrowser.nix` with the same config currently in `modules/scripts/qutebrowser.nix`.

```nix
{ config, pkgs, ... }:

{
  programs.qutebrowser = {
    enable = true;
    keyBindings = {
      normal = {
        "m" = "spawn mpv {url}";
      };
    };
    package = config.lib.nixGL.wrap pkgs.qutebrowser;
  };
}
```

- [ ] **Step 2: Update import lists**

Modify `modules/programs/default.nix`:

```nix
  imports = [
    ./bat.nix
    ./eza.nix
    ./fd.nix
    ./fzf.nix
    ./github.nix
    ./television.nix
    ./yazi.nix
    ./zoxide.nix
    ./direnv.nix
    ./fastfetch.nix
    ./git.nix
    ./tmux.nix
    ./helix
    ./opencode
    ./yt-dlp.nix
    ./neovim.nix
    ./kitty.nix
    ./pinta.nix
    ./alacritty.nix
    ./packages.nix
    ./qutebrowser.nix
  ];
```

Modify `modules/scripts/default.nix` by removing `./qutebrowser.nix` from the import list.

- [ ] **Step 3: Delete the old misplaced module**

Delete `modules/scripts/qutebrowser.nix`.

- [ ] **Step 4: Run validation**

Run: `home-manager build --flake .#mintori`
Expected: qutebrowser behavior remains unchanged; only file location and import ownership changed

- [ ] **Step 5: Commit**

```bash
git add modules/programs/default.nix modules/programs/qutebrowser.nix modules/scripts/default.nix modules/scripts/qutebrowser.nix
git commit -m "refactor: move qutebrowser module into programs group"
```

### Task 4: Extract Shared Script Wrapper Helper

**Files:**
- Create: `modules/scripts/_helpers.nix`
- Modify: `modules/scripts/install-font.nix`
- Modify: `modules/scripts/install-rpm.nix`
- Modify: `modules/scripts/convert-file.nix`
- Modify: `modules/scripts/copy-files.nix`
- Modify: `modules/scripts/nano_usage.nix`
- Modify: `modules/scripts/sleep-cycles.nix`
- Modify: `modules/scripts/which_file.nix`
- Modify: `modules/scripts/bash-generation.nix`
- Modify: `modules/scripts/extract.nix`
- Modify: `modules/scripts/fzf-preview.nix`
- Modify: `modules/scripts/fzf-rg-edit.nix`
- Modify: `modules/scripts/mpvr.nix`
- Modify: `modules/scripts/scratch.nix`
- Modify: `modules/scripts/select-and-open-video.nix`
- Modify: `modules/scripts/telepush.nix`
- Modify: `modules/scripts/format.nix`

- [ ] **Step 1: Create wrapper helpers**

Create `modules/scripts/_helpers.nix`:

```nix
{ pkgs }:
let
  mkScriptPackage =
    {
      name,
      runtime,
      entry,
      extraPackages ? [ ],
      extraPathPackages ? [ ],
      extraEnv ? "",
    }:
    let
      pathPrefix =
        if extraPathPackages == [ ] then
          ""
        else
          ''export PATH="${pkgs.lib.makeBinPath extraPathPackages}:$PATH"'';
      script = pkgs.writeShellScriptBin name ''
        ${pathPrefix}
        ${extraEnv}
        exec ${runtime} "${entry}" "$@"
      '';
    in
    [ script ] ++ extraPackages;
in
{
  inherit mkScriptPackage;
}
```

- [ ] **Step 2: Convert a Bun-backed wrapper first**

Rewrite `modules/scripts/install-font.nix` as the reference conversion:

```nix
{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "ifont";
    runtime = "${pkgs.bun}/bin/bun";
    entry = "${../../scripts/execute/install-font.ts}";
  };
}
```

- [ ] **Step 3: Convert the remaining wrapper-only modules**

Apply the same pattern to the other simple wrapper modules while preserving each command name and runtime:

```text
install-rpm.nix -> irpm -> bun
convert-file.nix -> cv -> bun
copy-files.nix -> cpath -> bun
nano_usage.nix -> nano-usage -> bun
sleep-cycles.nix -> sleep-cycles -> bun
which_file.nix -> wf -> bun
bash-generation.nix -> ask -> python
extract.nix -> extract -> bash
fzf-preview.nix -> preview -> bash
fzf-rg-edit.nix -> rgf -> bash
mpvr.nix -> mpvr -> bash
scratch.nix -> temp -> bash
select-and-open-video.nix -> vd -> bash
telepush.nix -> telepush -> bash
```

- [ ] **Step 4: Convert the `format` wrapper last**

Keep `modules/scripts/format.nix` behavior unchanged, but use the helper for the wrapper script and keep formatter package assembly where it is.

Validation target:

```text
Current behavior: `format` exposes the same command name, PATH setup, and formatter inventory.
Structural improvement: wrapper construction becomes shared instead of hand-copied.
Validation: `home-manager build --flake .#mintori` and `command -v format`
```

- [ ] **Step 5: Run validation**

Run:
- `home-manager build --flake .#mintori`
- `home-manager build --flake .#mintori >/tmp/home-manager-modernize-build.log 2>&1 || tail -n 50 /tmp/home-manager-modernize-build.log`

Expected: build succeeds and wrapper refactor does not change command exposure

- [ ] **Step 6: Commit**

```bash
git add modules/scripts/_helpers.nix modules/scripts/*.nix
git commit -m "refactor: extract shared script wrapper helper"
```

### Task 5: Centralize Shell Constants And Remove Duplicated Settings

**Files:**
- Create: `modules/shell/_constants.nix`
- Modify: `modules/shell/environment.nix`
- Modify: `modules/shell/alias.nix`
- Modify: `modules/shell/zsh.nix`

- [ ] **Step 1: Create the shared shell constants file**

Create `modules/shell/_constants.nix`:

```nix
{
  fzfCompletionTrigger = "**";
  clipCopy = "wl-copy";
  clipPaste = "wl-paste";
  pnpmHome = "$HOME/.local/share/pnpm";
  spicetifyPath = "$HOME/.spicetify";
  intelliHome = "$HOME/.local/share/intellishell";
}
```

- [ ] **Step 2: Update `environment.nix` to read from shared constants**

Use the constants file so duplicated values become single-source:

```nix
{ ... }:
let
  c = import ./_constants.nix;
in
{
  home.sessionVariables = {
    CLIPCOPY = c.clipCopy;
    CLIPPASTE = c.clipPaste;
    PNPM_HOME = c.pnpmHome;
    FZF_COMPLETION_TRIGGER = c.fzfCompletionTrigger;
    INTELLI_HOME = c.intelliHome;
  };
}
```

- [ ] **Step 3: Update aliases and zsh init to read the same constants**

Preserve alias names and shell behavior while removing hard-coded duplication.

```text
Current behavior: clipboard aliases call `wl-copy` and `wl-paste`, zsh init exports `FZF_COMPLETION_TRIGGER`, and session path repeats some values.
Structural improvement: shell literals are defined once and referenced from the modules that need them.
Validation: generated zsh init still contains the same aliases, same plugin order, and the trigger value is intentionally unified to the live behavior chosen for the repo.
```

- [ ] **Step 4: Remove exact duplicates from `home.sessionPath` and package lists only when repeated verbatim**

Safe deduplications to perform in this pass:

```text
`~/.spicetify` and `$HOME/.spicetify`
duplicate `$HOME/.pnpm/bin`
```

Do not change path ordering beyond removing exact duplicates.

- [ ] **Step 5: Run validation**

Run:
- `home-manager build --flake .#mintori`
- `rg -n "FZF_COMPLETION_TRIGGER|wl-copy|wl-paste|\\.spicetify|\\.pnpm/bin" modules/shell`

Expected: one source of truth for each duplicated constant, and build output remains valid

- [ ] **Step 6: Commit**

```bash
git add modules/shell/_constants.nix modules/shell/environment.nix modules/shell/alias.nix modules/shell/zsh.nix
git commit -m "refactor: centralize shell constants and remove duplication"
```

### Task 6: Split Oversized Program Modules Into Internal Fragments

**Files:**
- Create: `modules/programs/helix/_packages.nix`
- Create: `modules/programs/helix/_config.nix`
- Modify: `modules/programs/helix/default.nix`
- Create: `modules/programs/opencode/_providers.nix`
- Create: `modules/programs/opencode/_mcp.nix`
- Modify: `modules/programs/opencode/default.nix`
- Create: `modules/programs/_nixgl-wrappers.nix`
- Modify: `modules/programs/kitty.nix`
- Modify: `modules/programs/alacritty.nix`
- Modify: `modules/programs/packages.nix`

- [ ] **Step 1: Split Helix internals without changing emitted config**

Move package inventory and TOML attrset into internal files:

```text
Current behavior: `modules/programs/helix/default.nix` defines wrapper packages and the full editor config in one file.
Structural improvement: move package list to `_packages.nix` and editor config attrset to `_config.nix`, keeping `default.nix` as the stable entrypoint.
Validation: `helix/config.toml` and `helix/languages.toml` remain semantically identical after regeneration.
```

- [ ] **Step 2: Split Opencode provider and MCP lists**

Move large static lists into focused data files:

```text
Current behavior: one file mixes wrapper construction, provider policy, MCP config, and xdg output wiring.
Structural improvement: keep the wrapper in `default.nix` and move `disabled_providers`, `enabled_providers`, and `mcp` attrsets into `_providers.nix` and `_mcp.nix`.
Validation: generated `opencode/config.json` remains semantically identical.
```

- [ ] **Step 3: Extract shared nixGL launcher helper**

Create a small helper for programs that only need a wrapped binary.

```nix
{ pkgs }:
{
  mkWrappedBinary = name: package: pkgs.writeShellScriptBin name ''
    exec env \
      FREETYPE_PROPERTIES="autofitter:no-stem-darkening=1 cff:no-stem-darkening=1" \
      nixGL \
      ${package}/bin/${name} \
      "$@"
  '';
}
```

Use it where it fits for `kitty` and `alacritty`. Do not change the wrapped command names.

- [ ] **Step 4: Run validation**

Run:
- `home-manager build --flake .#mintori`
- `command -v hx`
- `command -v opencode`
- `command -v kitty`
- `command -v alacritty`

Expected: same commands are exposed and generated configs are still produced

- [ ] **Step 5: Commit**

```bash
git add modules/programs/helix modules/programs/opencode modules/programs/_nixgl-wrappers.nix modules/programs/kitty.nix modules/programs/alacritty.nix modules/programs/packages.nix
git commit -m "refactor: split large program modules into focused fragments"
```

### Task 7: Consolidate Package Ownership And Remove Exact Duplicates

**Files:**
- Modify: `modules/packages.nix`
- Modify: `modules/programs/packages.nix`
- Modify: `docs/refactor/module-map.md`

- [ ] **Step 1: Define ownership boundaries in docs before moving packages**

Update `docs/refactor/module-map.md`:

```markdown
## Package ownership
- `modules/packages.nix`: shared CLI packages and generic tooling
- `modules/programs/packages.nix`: GUI or program-bound packages that require program-specific wrapping or companion config
- `modules/scripts/format.nix`: formatter runtime inventory used by the `format` command
```

- [ ] **Step 2: Remove exact duplicates from package lists**

Safe candidates already visible in the repo:

```text
`glow`
`kdlfmt`
```

Keep package ownership stable after deduplication. Do not move packages between modules unless the ownership rule from Step 1 clearly requires it.

- [ ] **Step 3: Run validation**

Run:
- `home-manager build --flake .#mintori`
- `rg -n "\\bglow\\b|\\bkdlfmt\\b" modules/packages.nix modules/programs/packages.nix`

Expected: each duplicate package is declared once in the appropriate owner module

- [ ] **Step 4: Commit**

```bash
git add docs/refactor/module-map.md modules/packages.nix modules/programs/packages.nix
git commit -m "refactor: consolidate package ownership and remove duplicates"
```

### Task 8: Final Parity Review And Refactor Notes

**Files:**
- Create: `docs/refactor/pass-summary.md`
- Modify: `docs/refactor/parity-checklist.md`

- [ ] **Step 1: Write a pass summary that maps each refactor to preserved behavior**

Create `docs/refactor/pass-summary.md`:

```markdown
# Refactor Pass Summary

## Pass 1: Dead code deletion
- Current behavior: active shell config comes from `modules/shell/*`
- Structural improvement: removed stale `modules/shell.nix`
- Validation: `home-manager build --flake .#mintori`

## Pass 2: Module boundary normalization
- Current behavior: qutebrowser behavior defined through `programs.qutebrowser`
- Structural improvement: moved module into `modules/programs/`
- Validation: `home-manager build --flake .#mintori`

## Pass 3: Script wrapper extraction
- Current behavior: commands keep the same names and runtimes
- Structural improvement: wrappers come from a shared helper
- Validation: `home-manager build --flake .#mintori` and command existence checks

## Pass 4: Shell constant centralization
- Current behavior: aliases and env exports stay stable
- Structural improvement: shared constants replace duplicated literals
- Validation: generated zsh/env inspection and build

## Pass 5: Large module splits
- Current behavior: generated Helix and Opencode configs remain stable
- Structural improvement: data and wrapper logic are separated
- Validation: generated config parity and build

## Pass 6: Package consolidation
- Current behavior: installed tools remain available
- Structural improvement: exact duplicates removed and ownership clarified
- Validation: build and package declaration review
```

- [ ] **Step 2: Mark any non-refactor migration follow-ups explicitly**

Add a section to `docs/refactor/parity-checklist.md`:

```markdown
## Separate migration tasks
- Nixpkgs or Home Manager upgrades
- nixGL strategy changes
- Bun/Python runtime replacement
- Opencode provider policy changes
- Alias, keybinding, or editor behavior changes
```

- [ ] **Step 3: Run final validation**

Run:
- `home-manager build --flake .#mintori`
- `command -v format wf ifont irpm cpath preview rgf hx opencode kitty alacritty`

Expected: build succeeds and the expected commands remain exposed

- [ ] **Step 4: Commit**

```bash
git add docs/refactor/pass-summary.md docs/refactor/parity-checklist.md
git commit -m "docs: summarize modernization passes and migration boundaries"
```
