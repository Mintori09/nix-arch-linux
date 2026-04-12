{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "mpvr" ''
    exec ${pkgs.bash}/bin/bash "${../../scripts/execute/mpvr.sh}" "$@"
  '';
in
{
  home.packages = [ script ];
}
