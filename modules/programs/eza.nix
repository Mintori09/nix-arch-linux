{ pkgs, ... }:
{
  home.shellAliases = {
    ls = "${pkgs.eza}/bin/eza --color=always --icons --group-directories-first --header --time-style=long-iso --git";
    ll = "${pkgs.eza}/bin/eza -l --color=always --icons --group-directories-first --header --time-style=long-iso --git";
    lsd = "${pkgs.eza}/bin/eza --color=always --icons --group-directories-first --header --time-style=long-iso --git -a";
    lt = "${pkgs.eza}/bin/eza --tree --icons --level=2";
  };

  programs.eza = {
    enable = true;
  };
}
