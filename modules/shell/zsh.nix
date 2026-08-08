{ pkgs, lib, ... }:
let
  c = import ./_constants.nix;
  systemPathPriorityZsh = lib.concatStringsSep "\n          " c.systemPathPriority;
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

        # Use global FZF_DEFAULT_OPTS in fzf-tab
        zstyle ':fzf-tab:*' use-fzf-default-opts yes

        zstyle ':fzf-tab:*' fzf-flags \
          '--layout=reverse' \
          '--info=inline' \
          '--height=80%' \
          '--border=rounded'

        zstyle ':fzf-tab:complete:*:*' fzf-preview 'preview $realpath'

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
        export FZF_CTRL_R_OPTS="--no-preview"

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

          # Ctrl+O: plaintext file search → nvim
          fzf-select() {
            emulate -L zsh
            local file
            file="$(
              ${pkgs.ripgrep}/bin/rg -l '.*' --hidden --glob '!.git' --glob '!.venv' --glob '!node_modules' --glob '!target' 2>/dev/null |
              fzf --height=80% --reverse \
                --preview '${pkgs.bat}/bin/bat --color=always --line-range :50 {}'
            )" && [[ -n "$file" ]] && nvim "$file"
          }
          zle -N fzf-select
          bindkey -M viins '^O' fzf-select
          zvm_bindkey vicmd '^O' fzf-select

          # Bind Ctrl+R to mcfly-fzf history search (zsh-vi-mode safe)
          zvm_bindkey viins '^R' mcfly-fzf-history-widget
          zvm_bindkey vicmd '^R' mcfly-fzf-history-widget
          bindkey -M emacs '^R' mcfly-fzf-history-widget

          # Alt+Z: zoxide interactive picker via fzf
          zoxide-fzf() {
            local dir
            dir="$(${pkgs.zoxide}/bin/zoxide query --interactive)" || return
            [[ -n "$dir" ]] && builtin cd -- "$dir"
            redraw-prompt
          }

          # p10k không re-tính prompt trên reset-prompt nên phải chạy lại
          # precmd rồi buộc p10k vẽ lại toàn bộ (dir, vcs, ...)
          redraw-prompt() {
            local f
            for f in chpwd "''${chpwd_functions[@]}" precmd "''${precmd_functions[@]}"; do
              [[ "''${+functions[$f]}" == 0 ]] || "$f" &>/dev/null || true
            done
            p10k display -r
          }
          zle -N zoxide-fzf
          zvm_bindkey viins '\ez' zoxide-fzf
          zvm_bindkey vicmd '\ez' zoxide-fzf
          bindkey -M emacs '\ez' zoxide-fzf
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

        # FZF-tab completion for dvt
        zstyle ':fzf-tab:complete:dvt:*' fzf-flags \
          '--prompt=dvt > ' \
          '--height=60%' \
          '--reverse'
        typeset -U path
        path=(
          ${systemPathPriorityZsh}
          $path
        )
        export PATH

        set_cdd() {
            CDD=$(basename "$PWD")
        }
        autoload -Uz add-zsh-hook
        add-zsh-hook chpwd set_cdd
        set_cdd

        # Auto-reload completions when Nix updates them (no zsh reload needed)
        _zsh_auto_reload_completions() {
          local f target
          for f in ~/.local/share/zsh/site-functions/_*(N); do
            target=$f:A
            if [[ ! -v _zcomp_cache[$f] ]]; then
              _zcomp_cache[$f]=$target
            elif [[ $_zcomp_cache[$f] != $target ]]; then
              _zcomp_cache[$f]=$target
              unfunction $f:t 2>/dev/null
              autoload -Uz $f:t
            fi
          done
        }
        typeset -gA _zcomp_cache
        add-zsh-hook precmd _zsh_auto_reload_completions

      '')
    ];
  };
}
