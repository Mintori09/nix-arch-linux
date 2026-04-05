{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "rgf" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/execute/fzf-rg-edit.sh}" "$@"
  '';
in
{
  home.packages = [ script ];
}
