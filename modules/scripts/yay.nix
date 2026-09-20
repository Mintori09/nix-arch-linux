{ pkgs, ... }:

let
  yayCompletion = pkgs.writeTextFile {
    name = "yay-zsh-completion";
    destination = "/share/zsh/site-functions/_yay";
    text = builtins.readFile ./completions/_yay;
  };
in
{
  home.packages = [ yayCompletion ];
}
