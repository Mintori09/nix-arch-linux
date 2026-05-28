{ lib, ... }:
{
  imports = [
    ./ollama.nix
    ./icons.nix
    ./rclone.nix
  ];
}
