{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "cpath" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/execute/copy-files.ts}" "$@"
  '';
in
{
  home.packages = [ script ];
}
