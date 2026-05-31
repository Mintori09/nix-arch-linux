# ~/.config/home-manager

Nix home-manager standalone config for EndeavourOS (non-NixOS).
User: `mintori`, host: `endeavour-desktop`, system: `x86_64-linux`.

## Apply config

```bash
hms  # alias: home-manager switch --flake ~/.config/home-manager
nix flake update && hms  # update inputs then apply
nix-collect-garbage --delete-older-than 2d  # GC cleanup
```

## Structure

- `flake.nix` — entrypoint: imports `home.nix`, pins 15+ inputs (agent skills, sops-nix, spicetify-nix, mcp-servers-nix, llm-agents, nixGL)
- `home.nix` — imports `./modules` and `./modules/packages.nix`
- `modules/` — Nix modules organized by domain (programs, shell, scripts, config, secrets, fonts)
- `modules/default.nix` — aggregates all submodules

## Secrets

`secrets.json` (gitignored) loaded via jq `eval` in bash/zsh initExtra (`modules/secrets.nix`).
Secrets are exported as env vars at shell startup.

## OpenCode config

Generated purely from Nix in `modules/programs/agents/opencode/config.nix`:
output is written to `~/.config/opencode/config.json` as `builtins.toJSON`.
Do NOT edit `config.json` directly — edit the Nix source and run `hms`.

- **Provider**: only `opencode-go` enabled; all others explicitly disabled
- **Model**: `opencode-go/deepseek-v4-flash`
- **Permission rules**: deny read/edit on `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.kube`, `.env*`, `*.pem`, `*.key`
- **Plugins**: `superpowers`, `opencode-dcp`, `opencode-notifier`
- **LSPs/formatters**: defined in `languages.nix` — biome, nil, marksman, pyright, rust-analyzer, typescript-language-server, volar, alejandra
- **MCP servers**: defined in `mcp.nix` (wraps shared `../mcp.nix`), supports both `local` and `remote` types

## MCP servers

Shared between Claude and OpenCode via `modules/programs/agents/mcp.nix`.
OpenCode wraps it in its own format (`mcp.nix` transforms the shared format).
Claude config in `modules/programs/agents/claude/mcp.nix`.

## Skills

Sourced from 9+ external flake inputs (`anthropic-skills`, `vercel-skills`, `agent-toolkit`, etc.)
and linked to `~/.config/opencode/skill/`, `~/.claude/skills/`, `~/.codex/skills/`.
Enabled: skill-creator, webapp-testing, frontend-design, react-best-practices, technical-writing,
blog-post-writer, writing-documentation, changelog-generator, commit-work, skill-seekers.

## Git

- SSH signing (`~/.ssh/id_ed25519.pub`), `commit.gpgsign = true`
- `pull.rebase = true`, `push.autoSetupRemote = true`, `fetch.prune = true`
- Delta diff viewer with catppuccin-mocha theme, `merge.conflictstyle = zdiff3`
- Aliases: `gst` (status), `gll` (fzf log browser), `gcw` (clone from clipboard)

## Custom scripts (in modules/scripts/)

`convert-file`, `format-file`, `install-font`, `install-rpm`, `fzf-rg-edit`, `extract`,
`which_file`, `open`, `scratch`, `select-and-open-video`, `copy-files`, `each`,
`compress-wrap`, `direnv-wrap`, `rclone-sync`, `sleep-cycles`, `telepush`, `nano_usage`

## Shell

- Zsh primary (vi-mode, autosuggestions, fzf-tab, p10k prompt)
- Fish and Nushell also configured
- Custom `cd` with fzf directory picker
- `Ctrl+O` for fzf file search → Neovim

## Notable deps

`formatters.nix` → gofumpt, hadolint, kdlfmt, ruff, shellcheck, shfmt, stylua, taplo
LSPs → 9+ built into OpenCode config automatically
`nodejs_22`, `pnpm`, `bun`, `mise` for JS/Dev envs
`nixGL` overlay for GPU-accelerated apps on non-NixOS
