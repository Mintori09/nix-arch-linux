{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "scratch" ''
    exec ${pkgs.bash}/bin/bash "${../../scripts/execute/mpvr.sh}" "$@"
  '';
in
{
  home.packages = [ script ];
}
