#!/usr/bin/env zsh
# dvt -- Nix dev templates from the-nix-way/dev-templates
# Source this file to get dvt, dvtl, dvtu, and _dvt completion.

# ---- constants ---------------------------------------------------------------
: "${DVT_CACHE_DIR:="${XDG_CACHE_HOME:-$HOME/.cache}/dev-templates"}"
typeset -r DVT_FLAKE_URL="github:the-nix-way/dev-templates"

# 43 templates from github:the-nix-way/dev-templates (alphabetical)
typeset -ra DVT_STATIC_TEMPLATES=(
  bun  c-cpp  clojure  csharp  cue  deno  dhall
  elixir  elm  empty  gleam  go  hashi  haskell  haxe
  java  jupyter  kotlin  latex  lean4
  nickel  nim  nix  node
  ocaml  odin  opa
  php  platformio  protobuf  pulumi  purescript  python
  r  ruby  rust
  scala  shell  swi-prolog  swift
  typst
  vlang
  zig
)

# ---- cache helpers -----------------------------------------------------------
_dvt_cache_file() {
  echo "${DVT_CACHE_DIR}/templates.txt"
}

_dvt_get_templates() {
  local cache_file
  cache_file="$(_dvt_cache_file)"
  if [[ -r "$cache_file" ]]; then
    cat "$cache_file"
  else
    printf '%s\n' "${DVT_STATIC_TEMPLATES[@]}"
  fi
}

# ---- usage -------------------------------------------------------------------
_dvt_usage() {
  cat <<EOF
Usage: dvt <command> [args]

Commands:
  dvt init <template>          Initialize template in current directory
  dvt new <template> <dir>     Create new project directory from template
  dvt list                     Print all available templates
  dvt update-list              Refresh template list from GitHub
  dvt help                     Show this help

Shorthand:
  dvt <template>               Same as: dvt init <template>

Aliases:
  dvtl     -> dvt list
  dvtu     -> dvt update-list

Templates:
$(printf '  %s\n' $(_dvt_get_templates))
EOF
}

# ---- commands ----------------------------------------------------------------
dvt() {
  case "${1-}" in
    ''|help|-h|--help)
      _dvt_usage
      ;;
    list)
      _dvt_get_templates
      ;;
    update-list)
      dvt_update-list
      ;;
    init)
      dvt_init "${2-}"
      ;;
    new)
      dvt_new "${2-}" "${3-}"
      ;;
    *)
      dvt_init "$1"
      ;;
  esac
}

dvt_init() {
  local template="${1-}"

  if [[ -z "$template" ]]; then
    >&2 echo "Error: template name is required"
    _dvt_usage
    return 1
  fi

  if ! command -v nix >/dev/null 2>&1; then
    >&2 echo "Error: nix is not installed"
    return 1
  fi

  echo "Initializing template: $template"
  nix flake init -t "${DVT_FLAKE_URL}#${template}" || return $?

  echo "Next: run nix develop, or direnv allow if you use direnv."
}

dvt_new() {
  local template="${1-}"
  local directory="${2-}"

  if [[ -z "$template" ]] || [[ -z "$directory" ]]; then
    >&2 echo "Error: template name and directory are both required"
    _dvt_usage
    return 1
  fi

  if ! command -v nix >/dev/null 2>&1; then
    >&2 echo "Error: nix is not installed"
    return 1
  fi

  echo "Creating project '$directory' from template: $template"
  nix flake new -t "${DVT_FLAKE_URL}#${template}" "${directory}" || return $?

  echo "Next: cd ${directory}, then run nix develop, or direnv allow if you use direnv."
}

dvt_update-list() {
  local cache_dir cache_file

  if ! command -v nix >/dev/null 2>&1; then
    >&2 echo "Error: nix is not installed. Cannot refresh template list."
    return 1
  fi

  if ! command -v jq >/dev/null 2>&1; then
    >&2 echo "Error: jq is required to parse the template list. Install it with: nix profile install nixpkgs#jq"
    return 1
  fi

  cache_dir="$DVT_CACHE_DIR"
  cache_file="$(_dvt_cache_file)"
  mkdir -p "$cache_dir" || return 1

  local json templates
  if json="$(nix flake show "${DVT_FLAKE_URL}" --json 2>/dev/null)"; then
    templates="$(echo "$json" | jq -r '[.templates | keys[]] | sort[]' 2>/dev/null)"
    if [[ -n "$templates" ]]; then
      echo "$templates" > "$cache_file"
      local count
      count="$(echo "$templates" | wc -l)"
      echo "Updated template list ($count templates)"
      return 0
    fi
  fi

  if [[ -r "$cache_file" ]]; then
    local mtime
    mtime="$(date -r "$cache_file" 2>/dev/null)"
    >&2 echo "Warning: could not refresh from GitHub. Using cached list from ${mtime:-unknown}."
  else
    >&2 echo "Error: could not fetch templates from GitHub and no cache exists. Using built-in static list."
  fi
  return 1
}

# ---- aliases -----------------------------------------------------------------
alias dvtl='dvt list'
alias dvtu='dvt update-list'

# ---- completion --------------------------------------------------------------
#compdef dvt

_dvt_template_list() {
  local -a templates
  local t
  while IFS= read -r t; do
    [[ -n "$t" ]] && templates+=("$t")
  done < <(_dvt_get_templates)
  _describe -t templates 'template' templates
}

_dvt() {
  local -a subcommands
  subcommands=(
    'init:Initialize template in current directory'
    'new:Create new project directory from template'
    'list:Print all available templates'
    'update-list:Refresh template list from GitHub'
    'help:Show usage'
  )

  case $CURRENT in
    2)
      _dvt_template_list
      _describe -t commands 'command' subcommands
      ;;
    3)
      case "${words[2]}" in
        init) _dvt_template_list ;;
        new)  _dvt_template_list ;;
      esac
      ;;
    4)
      case "${words[2]}" in
        new) _files -/ ;;
      esac
      ;;
  esac
}

compdef _dvt dvt
