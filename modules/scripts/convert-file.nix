{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
  cvCompletion = pkgs.writeTextFile {
    name = "cv-zsh-completion";
    destination = "/share/zsh/site-functions/_cv";
    text = builtins.readFile ./completions/_cv;
  };
in
{
  home.packages =
    (helpers.mkScriptPackage {
      name = "cv";
      entry = "${../../scripts/execute/convert-file.js}";
      extraPathPackages = [
        pkgs.ffmpeg
        pkgs.imagemagick
        pkgs.pandoc
        pkgs.python314Packages.markitdown
        pkgs.libreoffice
        pkgs.nodejs_22
        pkgs.python3Packages.weasyprint
        pkgs.chromium
        pkgs.yq-go
        pkgs.xlsx2csv
        pkgs.poppler
        pkgs.mermaid-cli
        pkgs.jq
      ];
    })
    ++ [ cvCompletion ];
}
