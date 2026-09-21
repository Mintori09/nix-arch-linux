{ pkgs, ... }:

let
  gitCommitDiffCompletion = pkgs.writeTextFile {
    name = "git-commit-diff-zsh-completion";
    destination = "/share/zsh/site-functions/_git-commit-diff";
    text = builtins.readFile ./completions/_git-commit-diff;
  };
in
{
  home.packages = [
    (pkgs.writeShellScriptBin "git-commit-diff" ''
      exec ${pkgs.python3}/bin/python ${../../scripts/execute/git-fzf.py} "$@"
    '')
    gitCommitDiffCompletion
  ];
}
