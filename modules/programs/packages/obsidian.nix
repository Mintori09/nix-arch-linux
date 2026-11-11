{ pkgs, ... }:

let
  sources = pkgs.callPackage ../../packages/_sources/generated.nix { };
  inherit (sources.obsidian) pname version src;

  appimageContents = pkgs.appimageTools.extract { inherit pname version src; };

  obsidianPkg = pkgs.appimageTools.wrapType2 {
    inherit pname version src;

    extraInstallCommands = ''
      cp -r ${appimageContents}/usr/share/icons $out/share/
    '';

    meta = with pkgs.lib; {
      description = "A powerful knowledge base that works on top of a local folder of plain text Markdown files";
      homepage = "https://obsidian.md";
      license = licenses.unfree;
      platforms = [ "x86_64-linux" ];
      mainProgram = "obsidian";
    };
  };

  inherit (import ../_nixgl-wrappers.nix { inherit pkgs; }) mkWrappedBinary;
  obsidian = mkWrappedBinary {
    name = "obsidian";
    package = obsidianPkg;
  };
in
{
  home.packages = [ obsidian ];

  xdg.desktopEntries."md.obsidian.Obsidian" = {
    name = "Obsidian";
    genericName = "Knowledge Base";
    comment = "Markdown knowledge base";
    icon = "obsidian";
    exec = "${obsidian}/bin/obsidian %u";
    terminal = false;

    startupNotify = true;

    categories = [
      "Office"
    ];
    mimeType = [
      "x-scheme-handler/obsidian"
    ];
    settings = {
      StartupWMClass = "md.obsidian.Obsidian";
    };
  };
}
