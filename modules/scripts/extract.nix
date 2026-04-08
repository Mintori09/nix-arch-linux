{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "extract" ''
    exec ${pkgs.bash}/bin/bash "${../../scripts/execute/extract-file.sh}" "$@"
  '';
in
{
  home.packages = [ script ];
}
