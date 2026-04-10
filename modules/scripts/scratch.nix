{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "scratch" ''
    exec ${pkgs.bash}/bin/bash "${../../scripts/execute/scratch.sh}" "$@"
  '';
in
{
  home.packages = [ script ];
}
