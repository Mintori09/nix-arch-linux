{ pkgs, ... }:
let
  script = pkgs.writeShellScriptBin "wf" ''
    exec ${pkgs.bun}/bin/bun run "${../../scripts/execute/which_file.ts}" "$@"
  '';
in
{
  home.packages = [ script ];
}
