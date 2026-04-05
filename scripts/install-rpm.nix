{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "irpm" ''
    exec ${pkgs.bun}/bin/bun run "$HOME/.config/shell/scripts/install-rpm.ts" "$@"
  '';
in
{
  home.packages = [ script ];
}
