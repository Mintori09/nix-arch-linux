{ lib, ... }:
{
  imports = [
    ./ollama.nix
    ./icons.nix
    ./rclone.nix
    ./mactahoe-kde.nix
    ./mime.nix
  ];
}
