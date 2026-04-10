{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "nano-usage" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/execute/nano-usage.ts}" "$@"
  '';
in
{
  home.packages = [ script ];
}
