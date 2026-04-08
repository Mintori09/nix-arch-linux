{ lib, ... }:
{
  imports = [
    ./programs
    ./shell
    ./scripts
    ./zsh_function.nix
    ./secrets.nix
  ];
}
