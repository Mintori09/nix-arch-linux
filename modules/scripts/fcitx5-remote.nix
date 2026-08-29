{ pkgs, ... }:

let
  fcitx5RemoteCompletion = pkgs.writeTextFile {
    name = "fcitx5-remote-zsh-completion";
    destination = "/share/zsh/site-functions/_fcitx5-remote";
    text = builtins.readFile ./completions/_fcitx5-remote;
  };
in
{
  home.packages = [ fcitx5RemoteCompletion ];
}
