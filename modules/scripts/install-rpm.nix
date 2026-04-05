{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "irpm" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/install-rpm.ts}" "$@"
  '';
in
{
  home.packages = [ script ];
}
