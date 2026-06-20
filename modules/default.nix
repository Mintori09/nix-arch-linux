{ lib, ... }:
{
  imports = [
    ./programs
    ./shell
    ./scripts
    ./systemd
    ./secrets.nix
    ./fonts.nix
    ./config
  ];
}
