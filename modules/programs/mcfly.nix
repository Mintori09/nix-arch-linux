{ pkgs, ... }:
{
  programs.mcfly = {
    enable = true;
    enableZshIntegration = true;
    keyScheme = "vim";
    fzf.enable = true;
    fuzzySearchFactor = 3;
  };

  # mcfly-fzf must be in PATH at runtime for its init shell script to work.
  # The upstream home-manager module adds mcfly twice instead of mcfly-fzf
  # when fzf.enable is true, so we add it explicitly here.
  home.packages = [ pkgs.mcfly-fzf ];
}
