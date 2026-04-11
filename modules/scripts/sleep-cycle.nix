{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "nano-usage" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/execute/sleep-cycles.ts}" "$@"
  '';
in
{
  home.packages = [ script ];
}
