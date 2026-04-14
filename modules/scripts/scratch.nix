{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "temp" ''
    exec ${pkgs.bash}/bin/bash "${../../scripts/execute/scratch.sh}" "$@"
  '';
in
{
  home.packages = [ script ];
}
