{ pkgs, ... }:
let
  tomlFormat = pkgs.formats.toml { };
in
{
  imports = [
    ./config.nix
  ];

  programs.yazi = {
    enable = false;
    enableZshIntegration = true;
    shellWrapperName = "y";

    plugins = {
      office = pkgs.fetchFromGitHub {
        owner = "macydnah";
        repo = "office.yazi";
        rev = "41ebef8be9dded98b5179e8af65be71b30a1ac4d";
        hash = "sha256-1nblr8caa55pvzilxw2qhacgkymfx4qa1ixjjy3wlrzyq3inhns0";
      };
    };
  };

  programs.zsh = {
    initContent = ''
      function y() {
        local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
        command yazi "$@" --cwd-file="$tmp"
        IFS= read -r -d ''' cwd < "$tmp"
        [ "$cwd" != "$PWD" ] && [ -d "$cwd" ] && builtin cd -- "$cwd"
        rm -f -- "$tmp"
      }
    '';
  };
}
