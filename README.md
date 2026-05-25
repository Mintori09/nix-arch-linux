# Home Manager Configuration

Declarative desktop environment configuration using Nix Flakes and Home Manager on EndeavourOS.

## Prerequisites

- Nix with Flakes enabled
- Home Manager installed in standalone mode

## Quick Start

Apply the configuration:

```bash
hms
```

`hms` is an alias for `home-manager switch --flake ~/.config/home-manager`.

## What's Configured

### Shell

- **Zsh**: vi-mode, autosuggestions, fast syntax highlighting, fzf-tab, Powerlevel10k prompt
- **Fish** and **Nushell** also configured
- Custom `cd` command with fzf directory picker
- Keyboard shortcuts: `Ctrl+O` for fzf file search into Neovim
- Aliases for navigation, development, and system management

### Development

- **Editors**: Helix, Neovim, Zed
- **Git**: Lazygit, Onefetch
- **Search/Navigation**: fzf, ripgrep, fd, zoxide, yazi
- **File listing**: bat, eza
- **Terminal multiplexers**: tmux
- **Environment**: direnv, mise
- **Formatters and linters**: gofumpt, hadolint, ruff, shellcheck, shfmt, stylua, taplo

### AI Agents

- **OpenCode**: Providers, MCP servers, language servers, custom skills
- **Claude Code**: MCP servers and configuration
- **Integrated skills**: memory-aware-architect, custom agent skills from external repos

### Terminals

- Kitty, Alacritty

### Custom Scripts

- `convert-file`: Convert between formats using FFmpeg, ImageMagick, Pandoc, and others
- `format-file`: Format source code with Prettier and external formatters
- `install-font`: Download and install fonts
- `install-rpm`: Extract and install RPM packages on non-RPM distributions
- `fzf-rg-edit`: Search with ripgrep, edit with fzf
- `extract`: Archive extraction helper
- `which_file`: Locate commands, executables, and zsh functions

### Other

- **Fonts**: SF Pro Display, Inter, JetBrains Mono Nerd Font
- **Secrets**: sops-nix and JSON-based environment variable injection
- **Media**: yt-dlp, OBS, spicetify
- **Browser**: qutebrowser
- **Local LLMs**: Ollama

## Structure

```
modules/
├── programs/        # Application configurations
│   ├── agents/      # AI agent setups
│   ├── helix/       # Helix editor
│   ├── zed/         # Zed editor
│   └── ...
├── shell/           # Shell environments and aliases
│   ├── zsh.nix
│   ├── fish.nix
│   └── alias.nix
├── scripts/         # Custom utility scripts
├── config/          # System service configs (ollama)
├── fonts.nix
└── secrets.nix
```

## Usage

Apply configuration after changes:

```bash
hms
```

Update flake inputs and apply:

```bash
nix flake update && hms
```

## License

MIT
