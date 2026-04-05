{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "preview" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/fzf-preview.sh}" "$@"
  '';
in
{
  home.packages = [ script ];
}
