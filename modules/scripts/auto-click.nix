{ pkgs, ... }:

{
  home.packages = [
    (pkgs.writeShellScriptBin "auto-click" ''
      ${builtins.readFile ../../scripts/execute/auto-click.sh}
    '')
  ];
}
