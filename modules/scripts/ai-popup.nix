{ pkgs, ... }:

let
  aiPopupScript = pkgs.writeShellScriptBin "ai-popup" ''
    ${builtins.readFile ../../scripts/execute/ai-popup.sh}
  '';
in
{
  home.packages = [
    aiPopupScript
  ];
}
