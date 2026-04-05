{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "format" ''
    exec ${pkgs.bun}/bin/bun run "$HOME/.config/shell/scripts/format-file.ts" "$@"
  '';
in
{
  home.packages = [ script ];
}
