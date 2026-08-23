{ pkgs, ... }:

let
  helpers = import ./_helpers.nix { inherit pkgs; };

  ankiCompletion = pkgs.writeTextFile {
    name = "anki-tool-zsh-completion";
    destination = "/share/zsh/site-functions/_anki-tool";
    text = builtins.readFile ./completions/_anki-tool;
  };

in
{
  home.packages = [ ankiCompletion ];
}
