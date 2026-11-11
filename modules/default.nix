{ lib, ... }:
{
  imports = [
    ./programs
    ./shell
    ./scripts
    ./systemd
    ./desktop-action
    ./secrets.nix
    ./overlays.nix
    ../fonts/default.nix
    ./config
  ];
}
