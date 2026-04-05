{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "cv" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/execute/convert-file.ts}" "$@"
  '';
in
{
  home.packages = [ script ];
}
