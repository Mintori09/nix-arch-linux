{ lib, ... }:
{
  imports = [
    ./programs
    ./shell
    ./scripts
    ./systemd
    ./secrets.nix
    ./overlays.nix
    ../fonts/default.nix
    ./config
  ];
}
