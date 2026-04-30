# home.nix (snippet)
{ config, pkgs, ... }:

let
  sfDir = ../fonts/SF-Pro-Display;

  # readDir returns attrset: { filename = "regular" | "directory"; }
  sfFonts = builtins.filter (
    name: (builtins.readDir sfDir)."${name}" == "regular" && builtins.match ".*\\.otf" name != null
  ) (builtins.attrNames (builtins.readDir sfDir));

  sfFontFiles = builtins.listToAttrs (
    map (name: {
      name = "fonts/${name}";
      value = {
        source = sfDir + "/${name}";
      };
    }) sfFonts
  );
in
{
  fonts.fontconfig.enable = true;

  xdg.dataFile = sfFontFiles;

  home.packages = with pkgs; [
    inter
    nerd-fonts.jetbrains-mono
  ];
}
