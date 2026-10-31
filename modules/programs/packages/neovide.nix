{ pkgs, ... }:

let
  inherit (import ../_nixgl-wrappers.nix { inherit pkgs; }) mkWrappedBinary;
  neovide = mkWrappedBinary {
    name = "neovide";
    package = pkgs.neovide;
  };
in
{
  home.packages = [ neovide ];

  xdg.desktopEntries.neovide = {
    name = "Neovide";
    genericName = "Text Editor";
    comment = "No Nonsense Neovim Client in Rust";
    icon = "neovide";
    exec = "${neovide}/bin/neovide %F";
    terminal = false;
    startupNotify = true;
    categories = [
      "Utility"
      "TextEditor"
      "Development"
    ];
    mimeType = [
      "text/english"
      "text/plain"
      "text/x-makefile"
      "text/x-c++hdr"
      "text/x-c++src"
      "text/x-chdr"
      "text/x-csrc"
      "text/x-java"
      "text/x-moc"
      "text/x-pascal"
      "text/x-tcl"
      "text/x-tex"
      "application/x-shellscript"
      "text/x-c"
      "text/x-c++"
      "application/json"
      "application/toml"
      "application/yaml"
      "text/markdown"
    ];
    settings = {
      StartupWMClass = "neovide";
    };
  };
}
