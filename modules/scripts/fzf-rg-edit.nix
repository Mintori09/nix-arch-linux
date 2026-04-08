{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "rgf" ''
    exec ${pkgs.bash}/bin/bash "${../../scripts/execute/fzf-rg-edit.sh}" "$@"
  '';
in
{
  home.packages = [ script ];
}
