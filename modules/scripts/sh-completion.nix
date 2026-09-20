{ pkgs, ... }:

let
  shCompletion = pkgs.writeTextFile {
    name = "sh-zsh-completion";
    destination = "/share/zsh/site-functions/_sh";
    text = builtins.readFile ./completions/_sh;
  };
in
{
  home.packages = [ shCompletion ];
}
