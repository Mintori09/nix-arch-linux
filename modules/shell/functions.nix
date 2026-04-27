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
      codex-with() {
        local name="$1"
        shift

        local src="$HOME/.codex/auth.$name.json"
        local default="$HOME/.codex/auth.default.json"
        local active="$HOME/.codex/auth.json"

        if [[ -z "$name" ]]; then
          echo "Usage: codex-with one|two -- codex args"
          return 1
        fi

        if [[ ! -f "$src" ]]; then
          echo "Không tìm thấy: $src"
          return 1
        fi

        if [[ ! -f "$default" ]]; then
          echo "Không tìm thấy default: $default"
          echo "Tạo bằng: cp ~/.codex/auth.json ~/.codex/auth.default.json"
          return 1
        fi

        {
          cp "$src" "$active"
          echo "Switched Codex to account: $name"
          codex "$@"
        } always {
          cp "$default" "$active"
          echo "Restored Codex to default account"
        }
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
