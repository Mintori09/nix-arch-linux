{ lib, ... }:
{
  imports = [
    ./programs
    ./shell
    ./scripts
    ./systemd
    ./secrets.nix
    ../fonts/default.nix
    ./config
  ];
}
