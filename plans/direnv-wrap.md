# Plan: Direnv Wrapper for Quick Language Environments

## Status: COMPLETED ✅

## Context

The user wants to create a wrapper tool for `direnv` that quickly sets up development environments for various languages like Python, Node.js, etc. Currently, the system already has `direnv` with `nix-direnv` enabled, but there's no convenient way to quickly bootstrap language-specific environments.

## Approach

Create a `dw` command-line tool that:
1. Generates `.envrc` files for different language environments
2. Optionally creates basic project scaffolding (e.g., `package.json`, `requirements.txt`)
3. Integrates with the existing Nix-based setup
4. Supports multiple languages: Python, Node.js, Go, Rust, Ruby, etc.

## Files Created

### New Files
- `scripts/execute/direnv-wrap.ts` - Main CLI tool for generating direnv environments
- `modules/scripts/direnv-wrap.nix` - Home Manager module for the script

### Modified Files
- `modules/scripts/default.nix` - Added import for direnv-wrap.nix

## Language Templates

| Language | .envrc content | Scaffold file |
|----------|---------------|---------------|
| Python | `use nix`<br>`layout python` | `requirements.txt` |
| Node.js | `use nix`<br>`layout node` | `package.json` |
| Go | `use nix`<br>`export GOPATH=$PWD/.go`<br>`export PATH=$GOPATH/bin:$PATH` | - |
| Rust | `use nix`<br>`export CARGO_HOME=$PWD/.cargo`<br>`export PATH=$CARGO_HOME/bin:$PATH` | - |
| Ruby | `use nix`<br>`layout ruby` | `Gemfile` |
| Java | `use nix`<br>`export JAVA_OPTS="-Xmx2g"` | - |
| Deno | `use nix`<br>`layout deno` | - |

## Usage

```bash
# List supported languages
dw list

# Initialize Python environment with scaffold
dw init python -s

# Initialize Node.js environment
dw init node

# Add to existing directory
dw add rust -d /path/to/project

# Get help
dw --help
```

## Verification Completed

- ✅ `dw list` - shows 7 language templates
- ✅ `dw init python -s` - creates `.envrc`, `.gitignore`, `requirements.txt`
- ✅ `dw init node -s` - creates `.envrc`, `.gitignore`, `package.json`
- ✅ Zsh completion installed