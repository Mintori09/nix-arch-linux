{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "cv" ''
    exec ${pkgs.bun}/bin/bun run "$HOME/.config/shell/scripts/convert-file.ts" "$@"
  '';
in
{
  home.packages = [ script ];
}
