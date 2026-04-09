{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "telepush" ''
    exec ${pkgs.bash}/bin/bash "${../../scripts/execute/telepush.sh}" "$@"
  '';
in
{
  home.packages = [ script ];
}
