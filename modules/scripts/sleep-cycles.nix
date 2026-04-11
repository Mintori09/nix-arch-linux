{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "sleep-cycles" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/execute/sleep-cycles.ts}" "$@"
  '';
in
{
  home.packages = [ script ];
}
