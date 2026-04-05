{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "ifont" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/install-font.ts}" "$@"
  '';
in
{
  home.packages = [ script ];
}
