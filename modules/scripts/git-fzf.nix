{ pkgs, ... }:

{
  home.packages = [
    (pkgs.writeShellScriptBin "git-commit-diff" ''
      exec ${pkgs.python3}/bin/python ${../../scripts/execute/git-fzf.py} "$@"
    '')
  ];
}
