{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "ifont" ''
    exec ${pkgs.bun}/bin/bun run "$HOME/.config/shell/scripts/install-font.ts" "$@"
  '';
in
{
  home.packages = [ script ];
}
