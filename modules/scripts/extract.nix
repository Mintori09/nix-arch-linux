{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "extract" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/execute/extract-file.sh}" "$@"
  '';
in
{
  home.packages = [ script ];
}


