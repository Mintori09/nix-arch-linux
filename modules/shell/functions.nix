{ config, pkgs, ... }:

{
  home.packages = with pkgs; [
    zoxide
    fzf
    eza
    fd
    bat
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
          local file
          file="$(
              fd -t f \
                  -E node_modules -E target -E .cache \
                  -e md -e txt -e ron\
                  -e json -e yaml -e yml -e toml -e xml \
                  -e html -e css -e js -e ts -e jsx -e tsx -e vue -e svelte \
                  -e py -e rb -e go -e rs -e java -e c -e h -e cpp -e hpp -e lua \
                  -e sh -e bash -e zsh -e fish \
                  -e nix -e cfg -e conf -e ini -e env \
                  -e sql -e hs -e scala -e clj \
                  -e lock -e log -e diff -e patch \
              | fzf --preview 'bat --color=always --style=numbers {}'
          )" && [ -n "$file" ] && nvim "$file"
      }

      envf() {
          local out expect key value

          out="$(
              env | cut -d= -f1 | sort -u |
              fzf --height 60% --reverse \
                  --prompt="ENV> " \
                  --header="Enter: copy value | Ctrl-Y: copy name" \
                  --expect=ctrl-y \
                  --preview 'printenv {} 2>/dev/null' \
                  --preview-window='right,60%,wrap'
          )" || return 1

          expect="$(printf %s "$out" | head -n 1)"
          key="$(printf %s "$out" | tail -n 1)"

          [ -z "$key" ] && return 0

          if [[ "$expect" == "ctrl-y" ]]; then
              value="$key"
          else
              value="$(printenv "$key" 2>/dev/null || true)"
          fi

          if command -v wl-copy >/dev/null 2>&1; then
              printf %s "$value" | wl-copy
          elif command -v xclip >/dev/null 2>&1; then
              printf %s "$value" | xclip -selection clipboard
          elif command -v pbcopy >/dev/null 2>&1; then
              printf %s "$value" | pbcopy
          else
              echo "No clipboard tool found (wl-copy/xclip/pbcopy)."
              return 1
          fi

          echo "Copied: $key"
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

          cp "$src" "$active"
          echo "Switched Codex to account: $name"
          codex "$@"
      }

      prefer_nix() {
          local pkg="$1"

          local path
          path="$(find /nix/store -maxdepth 1 -type d -name "*-''${pkg}-*" | head -n 1)"

          if [ -n "$path" ] && [ -d "$path/bin" ]; then
              export PATH="$path/bin:$PATH"
          else
              echo "Không tìm thấy package $pkg trong /nix/store"
              return 1
          fi
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
          local file
          file="$(
              fd -t f \
                  -E node_modules -E target -E .cache \
                  -e md -e txt -e ron\
                  -e json -e yaml -e yml -e toml -e xml \
                  -e html -e css -e js -e ts -e jsx -e tsx -e vue -e svelte \
                  -e py -e rb -e go -e rs -e java -e c -e h -e cpp -e hpp -e lua \
                  -e sh -e bash -e zsh -e fish \
                  -e nix -e cfg -e conf -e ini -e env \
                  -e sql -e hs -e scala -e clj \
                  -e lock -e log -e diff -e patch \
              | fzf --preview 'bat --color=always --style=numbers {}'
          )" && [ -n "$file" ] && nvim "$file"
      }

      envf() {
          local out expect key value

          out="$(
              env | cut -d= -f1 | sort -u |
              fzf --height 60% --reverse \
                  --prompt="ENV> " \
                  --header="Enter: copy value | Ctrl-Y: copy name" \
                  --expect=ctrl-y \
                  --preview 'printenv {} 2>/dev/null' \
                  --preview-window='right,60%,wrap'
          )" || return 1

          expect="$(printf %s "$out" | head -n 1)"
          key="$(printf %s "$out" | tail -n 1)"

          [ -z "$key" ] && return 0

          if [ "$expect" = "ctrl-y" ]; then
              value="$key"
          else
              value="$(printenv "$key" 2>/dev/null || true)"
          fi

          if command -v wl-copy >/dev/null 2>&1; then
              printf %s "$value" | wl-copy
          elif command -v xclip >/dev/null 2>&1; then
              printf %s "$value" | xclip -selection clipboard
          elif command -v pbcopy >/dev/null 2>&1; then
              printf %s "$value" | pbcopy
          else
              echo "No clipboard tool found (wl-copy/xclip/pbcopy)."
              return 1
          fi

          echo "Copied: $key"
      }
      prefer_nix() {
          local pkg="$1"

          local path
          path="$(find /nix/store -maxdepth 1 -type d -name "*-''${pkg}-*" | head -n 1)"

          if [ -n "$path" ] && [ -d "$path/bin" ]; then
              export PATH="$path/bin:$PATH"
          else
              echo "Không tìm thấy package $pkg trong /nix/store"
              return 1
          fi
      }
    '';
  };
}
