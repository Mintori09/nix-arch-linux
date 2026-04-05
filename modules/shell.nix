{ pkgs, lib, ... }:

{
  programs.zsh = {
    enable = true;
    autocd = true;
    enableCompletion = true;
    # Tắt highlight mặc định để dùng bản Fast bên dưới
    syntaxHighlighting.enable = false;

    # 1. Các plugin cần nạp trước hoặc nạp qua Home Manager
    plugins = [
      {
        name = "powerlevel10k";
        src = pkgs.zsh-powerlevel10k;
        file = "share/zsh/themes/powerlevel10k/powerlevel10k.zsh-theme";
      }
      {
        name = "powerlevel10k-config";
        src = ./.;
        file = "p10k.zsh";
      }
      {
        name = "zsh-vi-mode";
        src = pkgs.zsh-vi-mode;
        file = "share/zsh-vi-mode/zsh-vi-mode.plugin.zsh";
      }
      {
        name = "fzf-tab";
        src = pkgs.zsh-fzf-tab;
        file = "share/fzf-tab/fzf-tab.plugin.zsh";
      }
      {
        name = "zsh-autosuggestions";
        src = pkgs.zsh-autosuggestions;
        file = "share/zsh-autosuggestions/zsh-autosuggestions.zsh";
      }
      {
        name = "fast-syntax-highlighting";
        src = pkgs.zsh-fast-syntax-highlighting;
        file = "share/zsh/plugins/fast-syntax-highlighting/fast-syntax-highlighting.plugin.zsh";
      }
    ];

    initContent = lib.mkMerge [
      (lib.mkBefore ''
        # Powerlevel10k instant prompt
        if [[ -r "$\{XDG_CACHE_HOME:-$HOME/.cache\}/p10k-instant-prompt-$\{(%):-%n\}.zsh" ]]; then
          source "$\{XDG_CACHE_HOME:-$HOME/.cache\}/p10k-instant-prompt-$\{(%):-%n\}.zsh"
        fi

        # Đường dẫn function và completions
        fpath=(/usr/share/zsh/site-functions ${pkgs.zsh-completions}/share/zsh-completions/functions $fpath)

        # Cấu hình completion và fzf-tab
        zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
        zstyle ':completion:*' list-colors "''${(s.:.)LS_COLORS}"
        zstyle ':fzf-tab:*' fzf-flags '--layout=reverse' '--info=inline' '--height=80%' '--border=rounded'
        zstyle ':fzf-tab:complete:cd:*' fzf-preview '${pkgs.eza}/bin/eza -1 --color=always $realpath'
        zstyle ':fzf-tab:complete:*:*' fzf-preview '${pkgs.bat}/bin/bat --color=always --line-range :50 $realpath'
        zstyle ':fzf-tab:complete:kill:argument-rest' fzf-preview 'ps --pid=$word -o cmd --no-headers'
        zstyle ':fzf-tab:complete:systemctl-*:*' fzf-preview 'systemctl status $word'

        # Cài đặt biến môi trường
        export ZSH_AUTOSUGGEST_USE_ASYNC=1
        export ZSH_AUTOSUGGEST_BUFFER_MAX_SIZE=20
        export ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=#838ba7'
        export KEYTIMEOUT=1
        export FZF_COMPLETION_TRIGGER='**'

        # Lịch sử shell
        setopt appendhistory sharehistory hist_ignore_space hist_ignore_all_dups
        setopt hist_save_no_dups hist_ignore_dups hist_reduce_blanks hist_find_no_dups
        unsetopt BEEP

        export HISTSIZE=10000
        export HISTFILE="$HOME/.zsh_history"
        export SAVEHIST=$HISTSIZE
      '')

      # Chạy SAU các plugin (Quan trọng để Highlight hoạt động)
      (lib.mkAfter ''
        # Zsh-vi-mode callback
        function zvm_after_init() {
          zsh-vi-yank-to-clipboard() {
            zvm_yank
            if command -v wl-copy > /dev/null; then
                printf "%s" "$CUTBUFFER" | wl-copy
            fi
          }
          zvm_define_widget zsh-vi-yank-to-clipboard
          zvm_bindkey vicmd 'y' zsh-vi-yank-to-clipboard
          zvm_bindkey visual 'd' zvm_vi_delete
          zvm_bindkey visual '^?' zvm_vi_delete
          zvm_bindkey visual '^H' zvm_vi_delete
        }

        function zvm_after_lazy_keybindings() {
          zvm_set_cursor $'\e[6 q'
        }

        # FZF compgen functions
        _fzf_compgen_path() { ${pkgs.fd}/bin/fd --hidden -t f -E .git -E node_modules . "$1"; }
        _fzf_compgen_dir() { ${pkgs.fd}/bin/fd --hidden -t d -E .git -E node_modules . "$1"; }

        # Custom completion cho hàm 'fn' của bạn
        _fn() {
          local -a subcmds
          subcmds=('new' 'config' 'alias' 'unalias' 'delete' 'edit' 'list')
          if (( CURRENT == 2 )); then
            _describe 'command' subcmds
          elif (( CURRENT == 3 )); then
            case $words[2] in
              edit|alias)
                local script_dir="$HOME/.config/shell/scripts"
                local scripts=($(${pkgs.fd}/bin/fd -t f . "$script_dir" | sed 's!.*/!!'))
                _describe 'script' scripts
                ;;
            esac
          fi
        }
        compdef _fn fn

        # Nạp các plugin tô màu ở CUỐI CÙNG (Quy tắc bắt buộc của Zsh)
        source ${pkgs.zsh-autosuggestions}/share/zsh-autosuggestions/zsh-autosuggestions.zsh
        # echo ${pkgs.zsh-fast-syntax-highlighting}/share/zsh/site-functions/fast-syntax-highlighting.plugin.zsh
      '')
    ];
  };
}
