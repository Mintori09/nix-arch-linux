{ pkgs, lib, ... }:
let
  c = import ./_constants.nix;
in

{
  programs.zsh = {
    enable = true;
    autocd = true;
    enableCompletion = true;
    syntaxHighlighting.enable = false;

    plugins = [
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
        # Instant prompt (PHẢI đứng đầu)
        if [[ -r "$\{XDG_CACHE_HOME:-$HOME/.cache\}/p10k-instant-prompt-$\{(%):-%n\}.zsh" ]]; then
          source "$\{XDG_CACHE_HOME:-$HOME/.cache\}/p10k-instant-prompt-$\{(%):-%n\}.zsh"
        fi

        # Load Powerlevel10k đúng cách
        source ${pkgs.zsh-powerlevel10k}/share/zsh-powerlevel10k/powerlevel10k.zsh-theme
        POWERLEVEL9K_DISABLE_CONFIGURATION_WIZARD=true

        # Load config p10k
        [[ ! -f ${../../p10k.zsh} ]] || source ${../../p10k.zsh}

        # Completion path
        fpath=(
          /usr/share/zsh/site-functions
          ${pkgs.zsh-completions}/share/zsh-completions/functions
          $fpath
        )

        # Completion + fzf-tab config
        zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
        zstyle ':completion:*' list-colors "''${(s.:.)LS_COLORS}"

        zstyle ':fzf-tab:*' fzf-flags \
          '--layout=reverse' \
          '--info=inline' \
          '--height=80%' \
          '--border=rounded'

        zstyle ':fzf-tab:complete:cd:*' fzf-preview \
          '${pkgs.eza}/bin/eza -1 --color=always $realpath'

        zstyle ':fzf-tab:complete:*:*' fzf-preview \
          '${pkgs.bat}/bin/bat --color=always --line-range :50 $realpath'

        zstyle ':fzf-tab:complete:kill:argument-rest' fzf-preview \
          'ps --pid=$word -o cmd --no-headers'

        zstyle ':fzf-tab:complete:systemctl-*:*' fzf-preview \
          'systemctl status $word'

        # Env
        export ZSH_AUTOSUGGEST_USE_ASYNC=1
        export ZSH_AUTOSUGGEST_BUFFER_MAX_SIZE=20
        export ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=#838ba7'
        export KEYTIMEOUT=1
        export FZF_COMPLETION_TRIGGER='${c.fzfCompletionTrigger}'

        # History
        setopt appendhistory sharehistory
        setopt hist_ignore_space hist_ignore_all_dups
        setopt hist_save_no_dups hist_ignore_dups
        setopt hist_reduce_blanks hist_find_no_dups

        unsetopt BEEP

        export HISTSIZE=10000
        export HISTFILE="$HOME/.zsh_history"
        export SAVEHIST=$HISTSIZE

        # cd: no args -> pick directory via fzf, args -> normal cd
        cd() {
          if (( $# > 0 )); then
            builtin cd "$@"
            return
          fi

          local dir
          dir="$(
            ${pkgs.fd}/bin/fd --hidden --type d \
              --exclude .git \
              --exclude node_modules \
              --exclude venv \
              . . 2>/dev/null |
            fzf --height=40% --reverse \
              --preview '${pkgs.eza}/bin/eza -la --icons --group-directories-first {} 2>/dev/null'
          )" || return

          [[ -n "$dir" ]] && builtin cd -- "$dir"
        }
      '')

      # =========================
      # LOAD MUỘN (sau plugin)
      # =========================
      (lib.mkAfter ''
        # zsh-vi-mode callbacks
        function zvm_after_init() {
          zsh-vi-yank-to-clipboard() {
            zvm_yank
            if command -v ${c.clipCopy} > /dev/null; then
              printf "%s" "$CUTBUFFER" | ${c.clipCopy}
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

        # FZF compgen (fd)
        _fzf_compgen_path() {
          ${pkgs.fd}/bin/fd --hidden -t f -E .git -E node_modules . "$1"
        }

        _fzf_compgen_dir() {
          ${pkgs.fd}/bin/fd --hidden -t d -E .git -E node_modules . "$1"
        }

        # Custom completion: fn
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
      '')
    ];
  };
}
