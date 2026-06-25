{ config, pkgs, ... }:

let
  sfDir = ./SF-Pro-Display;

  sfFontFiles =
    if builtins.pathExists sfDir then
      let
        sfFonts = builtins.filter (
          name: (builtins.readDir sfDir)."${name}" == "regular" && builtins.match ".*\\.otf" name != null
        ) (builtins.attrNames (builtins.readDir sfDir));
      in
      builtins.listToAttrs (
        map (name: {
          name = "fonts/${name}";
          value = {
            source = sfDir + "/${name}";
          };
        }) sfFonts
      )
    else
      { };
in
{
  fonts.fontconfig.enable = true;

  xdg.dataFile = sfFontFiles;

  home.packages = with pkgs; [
    inter
    nerd-fonts.jetbrains-mono
    nerd-fonts.hack
  ];
}
