---
name: cli-completion-creator
description: >
  Generates robust shell completion scripts (primarily Zsh via _arguments, with support for Bash and Fish)
  for any CLI tool or command, integrates them into Nix Home-Manager, and configures modern UX styles
  (such as prefix-needed false for fzf-tab).
  ALWAYS use when the user asks to create, write, generate, or fix autocompletion / autocomplete
  for a CLI binary or command.
  Triggers (VN): "viết autocomplete", "viết completion", "tạo autocomplete zsh", "làm autocompletion cho", "viết zsh autocomplete", "gợi ý lệnh cho".
  Triggers (EN): "create completion", "generate zsh completion", "write autocomplete for", "add autocompletion", "shell completion script".
---

# CLI Completion Creator

This skill provides a standard workflow to analyze any CLI tool or binary, generate completion scripts (primarily standard Zsh `_arguments` completion), integrate them into this repository's **Nix Home-Manager** setup, and refine UX (displaying options without typing `-` first, previews via `fzf-tab`, dynamic completion via SQLite/JSON/API).

---

## 1. Overview Workflow

```
1. Inspect CLI Tool
   ├── Check built-in generator: <cmd> completion zsh / --completion / generate-completion
   └── Manual scan: <cmd> --help, <cmd> <subcmd> --help, flags, args

2. Design Completion Script (_<cmd>)
   ├── Global options / flags
   ├── Subcommands & sub-arguments
   ├── Dynamic completions (auto-fetch from DB, JSON config, RPC, API, cache)
   └── UX Tuning: prefix-needed false, matcher-list

3. Integrate into Home-Manager
   ├── Place file at modules/scripts/completions/_<cmd>
   ├── Register via pkgs.writeTextFile with destination = "/share/zsh/site-functions/_<cmd>"
   └── Declare in corresponding Nix module (home.packages)

4. Test & Verify
   ├── zsh -n syntax check
   ├── git add -N new file (mandatory for Nix Flakes)
   └── Rebuild: nh home switch ~/.config/home-manager (or hms)
```

---

## 2. Step-by-Step Guide

### Step 1: Check Built-in CLI Completion Capabilities
Before writing one manually, check if the CLI tool already provides a built-in completion generator:
```bash
<cmd> completion zsh
<cmd> --completion zsh
<cmd> completions zsh
<cmd> generate-completion zsh
```
- **If available**: Check the quality of the generated completion. If complete and sufficient, use it directly or extract it as a baseline.
- **If not available or lacks dynamic items (e.g. session lists, DB, models, config)**: Proceed to generate a complete custom script.

### Step 2: Scan & Analyze CLI Structure
Run and review:
1. Top-level help:
   ```bash
   <cmd> --help
   <cmd> -h
   ```
2. Gather subcommands list and run help for each:
   ```bash
   for sub in <sub1> <sub2> ...; do
     <cmd> "$sub" --help
   done
   ```
3. Identify argument types:
   - Files / Directories (`_files`, `_files -/`)
   - Static enum (`(opt1 opt2 opt3)`)
   - Dynamic: from SQLite DB, config JSON files, or sockets/daemons

---

## 3. Standard Zsh Completion Template (`_arguments`)

Create the file at `modules/scripts/completions/_<cmd>`:

```zsh
#compdef <cmd>

# 1. Dynamic Helpers (if applicable - use TTL caching + background refresh to prevent latency)
_cmd_dynamic_items() {
  local cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/<cmd>"
  local cache_file="$cache_dir/items.cache"
  local -a items
  local now=$(date +%s)
  local mtime=0

  if [[ -f "$cache_file" ]]; then
    mtime=$(stat -c %Y "$cache_file" 2>/dev/null || stat -f %m "$cache_file" 2>/dev/null || echo 0)
  fi

  # If cache file does not exist: call CLI synchronously once to populate
  if [[ ! -s "$cache_file" ]]; then
    mkdir -p "$cache_dir" 2>/dev/null
    <cmd> list-items 2>/dev/null > "$cache_file"
  elif (( now - mtime > 86400 )); then
    # If cache is older than 24h: refresh in background so Tab completion never lags
    (<cmd> list-items 2>/dev/null > "$cache_file") &!
  fi

  if [[ -s "$cache_file" ]]; then
    while IFS=$'\t' read -r id desc; do
      [[ -n "$id" ]] && items+=("${id}:${desc:-$id}")
    done < "$cache_file"
  fi

  if (( ${#items} > 0 )); then
    _describe -t items 'item' items
  else
    _message 'item name'
  fi
}

# 2. Subcommand Handlers
_cmd_sub() {
  local curcontext="$curcontext" state line ret=1
  local -A opt_args

  _arguments -C \
    '(-h --help)'{-h,--help}'[Show help]' \
    '--flag=[Flag description]:value:(val1 val2)' \
    '1:argument:_cmd_items' && ret=0

  return ret
}

# 3. Main Dispatcher
_<cmd>() {
  local curcontext="$curcontext" state line ret=1
  local -A opt_args

  # Enable prefix-needed false to display flags alongside subcommands on Tab
  zstyle ":completion:*:*:<cmd>:*" prefix-needed false

  local -a common_args
  common_args=(
    '(-h --help)'{-h,--help}'[Show help]'
    '(-v --version)'{-v,--version}'[Show version]'
    '--config=[Path to config file]:config file:_files'
    '--output=[Output format]:format:(json yaml text)'
  )

  _arguments -s -S -C \
    "$common_args[@]" \
    '1:subcommand:->subcmd' \
    '*::arguments:->subargs' && ret=0

  case "$state" in
    subcmd)
      local -a subcommands
      subcommands=(
        'start:Start the service'
        'stop:Stop the service'
        'status:Show status'
        'config:Manage configuration'
      )
      _describe -t subcommands '<cmd> subcommand' subcommands && ret=0
      ;;
    subargs)
      case "$words[1]" in
        start)
          _cmd_sub && ret=0
          ;;
        # Other subcommands...
      esac
      ;;
  esac

  return ret
}

_<cmd> "$@"
```

### Key `_arguments` Syntax Rules:
- `(-h --help)'{-h,--help}'[description]'`: Mutually exclusive options (typing one hides the other).
- `--flag=[desc]:message:action`: Flag takes a parameter (note the `=`). Using `=` enables both `--flag=val` and `--flag val`.
- `_files`: Completes files in the current directory.
- `_files -/`: Completes directories only.
- `_describe -t <tag> '<label>' <array>`: Renders items with descriptions.
- `prefix-needed false`: Allows users to press `<Tab>` to show `--flags` immediately without needing to type a dash first.

---

## 4. Integration into Nix Home-Manager

In the corresponding Nix module (e.g. `modules/scripts/<cmd>.nix` or program module in `modules/programs/` or `modules/packages/`):

```nix
{ pkgs, ... }:

let
  <cmd>Completion = pkgs.writeTextFile {
    name = "<cmd>-zsh-completion";
    destination = "/share/zsh/site-functions/_<cmd>";
    text = builtins.readFile ./completions/_<cmd>;
  };
in
{
  home.packages = [
    <cmd>Completion
  ];
}
```

If you wish to set `prefix-needed false` globally or in `zsh.nix`:
Add to `modules/shell/zsh.nix`:
```zsh
zstyle ':completion:*:*:<cmd>:*' prefix-needed false
```

---

## 5. Verification & Rebuild

1. **Check Zsh script syntax**:
   ```bash
   zsh -n modules/scripts/completions/_<cmd>
   ```

2. **Track new files in Git**:
   Since Nix Flakes only see files tracked by Git, **ALWAYS** run:
   ```bash
   git add -N modules/scripts/completions/_<cmd>
   ```

3. **Rebuild Home-Manager**:
   ```bash
   nh home switch ~/.config/home-manager
   ```

4. **Verify**:
   Check that symlinks are created:
   ```bash
   ls -la ~/.nix-profile/share/zsh/site-functions/_<cmd>
   ```
   Open a new zsh shell and test `<cmd> <Tab>`.
