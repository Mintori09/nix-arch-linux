{ lib, ... }:
{
  imports = [
    ./programs
    ./shell
    ./scripts
    ./secrets.nix
    ./fonts.nix
  ];
}
