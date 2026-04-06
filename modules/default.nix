{ lib, ... }:
{
  imports = [
    ./programs
    ./shell
    ./scripts
    ./zsh_function.nix

  ]
  ++ lib.optionals (builtins.pathExists ./secrets.nix) [ ./secrets.nix ];
}
