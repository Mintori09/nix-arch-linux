{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "format" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/execute/format-file.ts}" "$@"
  '';
in
{
  home.packages = [ script ];
}
