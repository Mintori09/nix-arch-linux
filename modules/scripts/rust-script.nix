{ pkgs, ... }:

let
  rustScriptCompletion = pkgs.writeTextFile {
    name = "rust-script-zsh-completion";
    destination = "/share/zsh/site-functions/_rust-script";
    text = builtins.readFile ./completions/_rust-script;
  };
in
{
  home.packages = [ rustScriptCompletion ];
}
