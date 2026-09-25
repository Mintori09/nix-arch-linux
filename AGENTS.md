# ~/.config/home-manager

Nix home-manager standalone config for EndeavourOS (non-NixOS).
User: `mintori`, host: `endeavour-desktop`, system: `x86_64-linux`.

## Apply config

> [!IMPORTANT]
> Always rebuild home-manager after making changes to any configuration files or scripts so they take effect immediately:
> ```bash
> nh home switch ~/.config/home-manager
> ```

```bash
nh home switch ~/.config/home-manager
nix flake update && home-manager switch --flake ~/.config/home-manager  # update inputs then apply
nix-collect-garbage --delete-older-than 2d  # GC cleanup
```

## Structure

- `flake.nix` — entrypoint: imports `home.nix`, pins 16 inputs (agent skills, sops-nix, spicetify-nix, mcp-servers-nix, llm-agents, nixGL)
- `home.nix` — imports `./modules` and `./modules/packages.nix`, sets `targets.genericLinux.enable = true` + nixGL for non-NixOS
- `modules/default.nix` — aggregates all submodules (programs, shell, scripts, config, secrets, fonts)
- `modules/packages.nix` — system packages (bun, pnpm, opencode, helix, lazygit, etc.)
- `p10k.zsh` — Powerlevel10k theme config (sourced by `modules/shell/zsh.nix`)
- `assets/catppuccin.gitconfig` — included by `modules/programs/git.nix`

## Secrets

`secrets.json` (gitignored) loaded via jq `eval` in bash/zsh initExtra (`modules/secrets.nix`).
Secrets are exported as env vars at shell startup.

## OpenCode config

Generated purely from Nix in `modules/programs/agents/opencode/config.nix`:
output is written to `~/.config/opencode/config.json` as `builtins.toJSON`.
Do NOT edit `config.json` directly — edit the Nix source and run `hms`.

- **Provider**: only `opencode-go` enabled; all others explicitly disabled
- **Model**: `opencode-go/deepseek-v4-flash`
- **Permission rules**: deny read on `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.azure`, `~/.kube`, `~/.docker`, `~/.config/gcloud`, `.env*`, `*.pem`, `*.key`, `*.p12`, `*.jks`, `*credentials*`; deny edit on first 6 paths; deny bash `rm` for `*credentials*` and `*.env*`
- **Plugins**: `superpowers`, `opencode-dcp`, `opencode-notifier`
- **LSPs/formatters**: defined in `languages.nix` — biome, nil, marksman, pyright, rust-analyzer, typescript-language-server, volar, alejandra, astro-ls, tailwindcss, oxfmt, ruff, shfmt, rustfmt
- **MCP servers**: defined in `mcp.nix` (wraps shared `../mcp.nix`), supports both `local` and `remote` types

## MCP servers

Shared across agents via `modules/programs/agents/mcp.nix`:
- **OpenCode** (`opencode/mcp.nix`): transforms format into `local` and `remote` types.
- **Claude** (`claude/mcp.nix`): supports local servers, plus conditionally adds `codex` MCP and `work-docs` on `work-laptop`.
- **Antigravity CLI** (`antigravity/mcp.nix` & `default.nix`): generates `~/.gemini/antigravity-cli/mcp_config.json`, includes custom zsh completion (`_agy`).
- **Copilot CLI** (`copilot-cli/mcp.nix` & `default.nix`): generates `~/.copilot/mcp-config.json` with `local` and `http` server definitions.
Servers configured: context7, playwright, github (uses `gh auth token` lazily via `$()`), deepwiki (remote), apify (remote), figwright, firefox-devtools, tavily (disabled by default).

## oc-go-cc proxy

`modules/programs/agents/oc-go-cc/` provides a local proxy that makes OpenAI-compatible models available to Claude Code.
Runs as a systemd user service (`systemctl --user oc-go-cc`).
Sets `ANTHROPIC_BASE_URL=http://127.0.0.1:3456` and `ANTHROPIC_AUTH_TOKEN=unused` so Claude Code routes through it.
Model tiers: default (v4-flash), think/complex (v4-pro), long_context (glm-5.1).

## Skills

Sourced from external flake inputs (anthropic-skills, vercel-skills, agent-toolkit, superpowers, etc.) and local skills (`modules/programs/agents/opencode/skills/`).
Symlinked to `~/.config/opencode/skill/`, `~/.claude/skills/`, `~/.codex/skills/`, `~/.gemini/skills/`, and `~/.copilot/skills/` via `programs.agent-skills`.
Enabled skills: skill-creator, webapp-testing, frontend-design, react-best-practices, technical-writing,
blog-post-writer, writing-documentation, changelog-generator, commit-work, skill-seekers, anki-vocab-generator, plus all from `opencode-local` (e.g. `novel-vi-translator`, `doc-to-jp-vocab`) and `superpowers`.
Conditional: `work-laptop` host adds `work/agent-skills`.

## Git

- SSH signing (`~/.ssh/id_ed25519.pub`), `commit.gpgsign = true`
- `pull.rebase = true`, `push.autoSetupRemote = true`, `fetch.prune = true`
- Delta diff viewer with catppuccin-mocha theme, `merge.conflictstyle = zdiff3`
- Aliases: `gst` (status), `gll` (fzf log browser), `gcw` (clone from clipboard)

## Custom scripts & packages

- Custom scripts (in `modules/scripts/`): `auto-click`, `caffeinate`, `cleartext-wifi`, `compress-wrap`, `copy-files`, `direnv-wrap`, `each`, `extract`, `fcitx5-remote`, `format`, `fzf-preview`, `fzf-rg-edit`, `keyboard-control`, `nano_usage`, `nix-rebuild`, `open`, `quick-aliases`, `rclone-sync`, `read`, `remove`, `scratch`, `select-and-open-video`, `sleep-cycles`, `telepush`, `which_file`. Shared helpers in `_helpers.nix`.
- Custom packages (in `modules/packages/` from `packages/`): `ai-bridge`, `anki-tool`, `anyflip-downloader`, `bookokrat`, `cv-cli` (`cv`), `dbx`, `fitgirl-link-extractor` (`mle`), `fmtron`, `generate-toc` (`gentoc`), `hoppscotch`, `keyboard-rs`, `kmp-lsp`, `magika`, `qbittorrent`, `vicinae`, `zap`, `zed-editor`.

Each script's source lives in `scripts/execute/<name>.ts`, with Nix packaging
and zsh completion in `modules/scripts/<name>.nix` (or `completions/`). When adding/modifying
flags, update both the source and the zsh completion spec in the same PR.
After editing, rebuild with `nh home switch ~/.config/home-manager` to make changes available
globally.

## Shell

- Zsh primary (vi-mode, autosuggestions, fast-syntax-highlighting, fzf-tab, p10k prompt, carapace completion integration)
- Default editor: `EDITOR=nvim`
- Fish also configured
- Custom `cd` with fzf directory picker
- `Ctrl+O` for fzf/rg file search → Neovim
- `Ctrl+R` for mcfly-fzf history search
- `Ctrl+G` for navi cheatsheet search
- zsh-vi-mode with clipboard yank on `y`
- Shell functions in `shell/functions.nix`, constants in `shell/_constants.nix`

## Notable deps

`formatters.nix` → gofumpt, hadolint, kdlfmt, ruff, shellcheck, shfmt, stylua, taplo, sql-formatter
LSPs → 10+ built into OpenCode config automatically
`nodejs_22`, `pnpm`, `bun`, `uv`, `mise` for JS/Python/Dev envs
`nixGL` overlay for GPU-accelerated apps on non-NixOS
