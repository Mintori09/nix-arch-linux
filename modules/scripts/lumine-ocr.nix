{ pkgs, ... }:

let
  lumineOcrScript = pkgs.writeShellScriptBin "lumine-ocr" ''
    ${builtins.readFile ../../scripts/execute/lumine-ocr.sh}
  '';
in
{
  home.packages = [
    lumineOcrScript
  ];
}
