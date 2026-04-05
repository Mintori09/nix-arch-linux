{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "cv" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/convert-file.ts}" "$@"
  '';
in
{
  home.packages = [ script ];
}
