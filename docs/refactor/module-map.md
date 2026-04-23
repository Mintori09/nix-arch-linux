# Module Map

## Top-level entrypoints
- `flake.nix`: defines `homeConfigurations.mintori`
- `home.nix`: imports `./modules` and `./modules/packages.nix`
- `modules/default.nix`: imports `programs`, `shell`, `scripts`, `zsh_function.nix`, and `secrets.nix`

## Shell
- `modules/shell/default.nix`: active shell import entrypoint
- `modules/shell/zsh.nix`: active Zsh plugins and init content
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
