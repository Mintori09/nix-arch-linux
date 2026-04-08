{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "ask" ''
    exec ${pkgs.python}/bin/python "${../../scripts/execute/bash-generation.py}" "$@"
  '';
in
{
  home.packages = [ script ];
}
