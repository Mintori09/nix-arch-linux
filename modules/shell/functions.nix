{ config, pkgs, ... }:

{
  home.packages = with pkgs; [
    zoxide
    fzf
    eza
  ];

  programs.zoxide = {
    enable = true;
    enableZshIntegration = true;
    enableBashIntegration = true;
  };

  programs.fzf = {
    enable = true;
    enableZshIntegration = true;
    enableBashIntegration = true;
  };

  programs.zsh = {
    enable = true;

    initContent = ''
      zo() {
          local dir
          dir="$(
              zoxide query -l "$@" |
              fzf --height 40% --reverse --preview 'eza -la --icons --group-directories-first {} 2>/dev/null || ls -la {}'
          )" && cd "$dir"
      }

      mkcd() {
          if [ -z "$1" ]; then
              echo "Error: Please add folder's name."
              return 1
          fi
          mkdir -p "$1" && cd "$1"
      }

      nf() {
          local file=$(fzf)
          [ -n "$file" ] && nvim "$file"
      }
    '';
  };

  programs.bash = {
    enable = true;

    initExtra = ''
      mkcd() {
          if [ -z "$1" ]; then
              echo "Error: Please add folder's name."
              return 1
          fi
          mkdir -p "$1" && cd "$1"
      }

      zo() {
          local dir
          dir="$(
              zoxide query -l "$@" |
              fzf --height 40% --reverse --preview 'eza -la --icons --group-directories-first {} 2>/dev/null || ls -la {}'
          )" && cd "$dir"
      }

      nf() {
          local file=$(fzf)
          [ -n "$file" ] && nvim "$file"
      }
    '';
  };
}
