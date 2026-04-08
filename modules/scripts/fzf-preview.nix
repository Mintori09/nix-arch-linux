{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "preview" ''
    exec ${pkgs.bash}/bin/bash "${../../scripts/execute/fzf-preview.sh}" "$@"
  '';
in
{
  home.packages = [ script ];
}
