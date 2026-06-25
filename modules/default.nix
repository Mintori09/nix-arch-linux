{ lib, ... }:
{
  imports = [
    ./programs
    ./shell
    ./kwin
    ./scripts
    ./systemd
    ./secrets.nix
    ../fonts/default.nix
    ./config
  ];
}
