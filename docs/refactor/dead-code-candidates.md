# Dead Code Candidates

## Candidate 1: `modules/shell.nix`
Current behavior:
- Defines a full `programs.zsh` configuration.
- Appears stale because `modules/default.nix` imports `./shell`, not `./shell.nix`.
- Live shell behavior currently comes from `modules/shell/default.nix`, `modules/shell/zsh.nix`, `modules/shell/alias.nix`, and `modules/shell/environment.nix`.

Structural improvement:
- Deleted after the import graph and build confirm it was unused.

Validation:
- `rg -n "shell\\.nix|\\./shell" modules home.nix`
- `home-manager build --flake .#mintori`
