{ pkgs, ... }:

let
  penpotScript = pkgs.writeShellScriptBin "penpot" ''
    ${builtins.readFile ../../scripts/execute/penpot.sh}
  '';
in
{
  home.packages = [
    penpotScript
  ];
}
