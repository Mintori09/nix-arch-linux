{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "wf" ''
    exec ${pkgs.bun}/bin/bun run "$HOME/.config/shell/scripts/which_file.ts" "$@"
  '';
in
{
  home.packages = [ script ];
}
