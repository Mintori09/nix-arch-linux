# ~/.config/home-manager

Nix home-manager standalone config for EndeavourOS (non-NixOS).
User: `mintori`, host: `endeavour-desktop`, system: `x86_64-linux`.

## Apply config

```bash
home-manager switch --flake ~/.config/home-manager
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

Shared between Claude and OpenCode via `modules/programs/agents/mcp.nix`.
OpenCode `mcp.nix` transforms the shared format; Claude `mcp.nix` does too, plus conditionally adds `codex` MCP and `work-docs` on `work-laptop`.
Servers: context7, playwright, github (uses `gh auth token` lazily via `$()`), filesystem (scoped to `~/projects`, `~/dotfiles`), deepwiki (remote), tavily (disabled by default).

## oc-go-cc proxy

`modules/programs/agents/oc-go-cc/` provides a local proxy that makes OpenAI-compatible models available to Claude Code.
Runs as a systemd user service (`systemctl --user oc-go-cc`).
Sets `ANTHROPIC_BASE_URL=http://127.0.0.1:3456` and `ANTHROPIC_AUTH_TOKEN=unused` so Claude Code routes through it.
Model tiers: default (v4-flash), think/complex (v4-pro), long_context (glm-5.1).

## Skills

Sourced from 9+ external flake inputs (anthropic-skills, vercel-skills, agent-toolkit, etc.)
and linked to `~/.config/opencode/skill/`, `~/.claude/skills/`, `~/.codex/skills/` as symlinks.
Enabled: skill-creator, webapp-testing, frontend-design, react-best-practices, technical-writing,
blog-post-writer, writing-documentation, changelog-generator, commit-work, skill-seekers.
Conditional: `work-laptop` host adds `work/agent-skills`.

## Git

- SSH signing (`~/.ssh/id_ed25519.pub`), `commit.gpgsign = true`
- `pull.rebase = true`, `push.autoSetupRemote = true`, `fetch.prune = true`
- Delta diff viewer with catppuccin-mocha theme, `merge.conflictstyle = zdiff3`
- Aliases: `gst` (status), `gll` (fzf log browser), `gcw` (clone from clipboard)

## Custom scripts (in modules/scripts/)

`convert-file`, `format-file`, `install-font`, `install-rpm`, `fzf-rg-edit`, `fzf-preview`, `extract`,
`which_file`, `open`, `scratch`, `select-and-open-video`, `copy-files`, `remove`, `each`,
`compress-wrap`, `direnv-wrap`, `rclone-sync`, `sleep-cycles`, `telepush`, `nano_usage`
Shared helpers in `_helpers.nix`.

Each script's source lives in `scripts/execute/<name>.ts`, with Nix packaging
and zsh completion in `modules/scripts/<name>.nix`. When adding/modifying
flags, update both the source and the zsh completion spec in the same PR.
After editing, rebuild with `home-manager switch` to make changes available
globally.

## Shell

- Zsh primary (vi-mode, autosuggestions, fast-syntax-highlighting, fzf-tab, p10k prompt)
- Fish also configured
- Custom `cd` with fzf directory picker
- `Ctrl+O` for fzf/rg file search → Neovim
- `Ctrl+R` for mcfly-fzf history search
- zsh-vi-mode with clipboard yank on `y`
- Shell functions in `shell/functions.nix`, constants in `shell/_constants.nix`

## Notable deps

`formatters.nix` → gofumpt, hadolint, kdlfmt, ruff, shellcheck, shfmt, stylua, taplo, sql-formatter
LSPs → 10+ built into OpenCode config automatically
`nodejs_22`, `pnpm`, `bun`, `mise` for JS/Dev envs
`nixGL` overlay for GPU-accelerated apps on non-NixOS
