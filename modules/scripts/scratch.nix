{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "temp" ''
    export PATH="${
      pkgs.lib.makeBinPath [
        pkgs.bash
        pkgs.magika
        pkgs.jq
        pkgs.coreutils
      ]
    }:$PATH"
    exec ${pkgs.bash}/bin/bash "${../../scripts/execute/scratch.sh}" "$@"
  '';
in
{
  home.packages = [ script ];
}
