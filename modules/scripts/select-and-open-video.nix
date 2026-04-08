{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "vd" ''
    exec ${pkgs.bash}/bin/bash "${../../scripts/execute/select-and-open-video.sh}" "$@"
  '';
in
{
  home.packages = [ script ];
}
