{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "rgf" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/fzf-rg-edit.sh}" "$@"
  '';
in
{
  home.packages = [ script ];
}
