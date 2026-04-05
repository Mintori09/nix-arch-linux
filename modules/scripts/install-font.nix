{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "ifont" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/execute/install-font.ts}" "$@"
  '';
in
{
  home.packages = [ script ];
}
