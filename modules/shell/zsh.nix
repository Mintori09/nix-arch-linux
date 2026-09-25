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
          "$HOME/.nix-profile/share/zsh/site-functions"
          /usr/share/zsh/site-functions
          ${pkgs.zsh-completions}/share/zsh-completions/functions
          $fpath
        )

        # Completion + fzf-tab config (prefix -> case-insensitive -> partial -> substring match)
        zstyle ':completion:*' matcher-list "" \
          'm:{a-z}={A-Za-z}' \
          'r:|[._-]=* r:|=*' \
          'l:|=* r:|=*'
        zstyle ':completion:*' list-colors "''${(s.:.)LS_COLORS}"
        zstyle ':completion:*:descriptions' format '-- %d --'
        zstyle ':completion:*' group-name ""

        # systemctl: prioritize services, sockets, timers and targets (hide cluttered devices)
        zstyle ':completion:*:*:systemctl:*' tag-order 'services' 'sockets' 'timers' 'targets'

        # agy / opencode / yay: show both flags/options along with subcommands on Tab
        zstyle ':completion:*:*:agy:*' prefix-needed false
        zstyle ':completion:*:*:opencode:*' prefix-needed false
        zstyle ':completion:*:*:yay:*' prefix-needed false

        # fzf-tab configuration: decoupled from FZF_DEFAULT_OPTS
        zstyle ':fzf-tab:*' use-fzf-default-opts no
        zstyle ':fzf-tab:*' default-color ""
        zstyle ':fzf-tab:*' prefix ""

        # Default preview-window hidden, opens only when preview content exists
        zstyle ':fzf-tab:*' fzf-flags \
          '--layout=reverse' \
          '--info=inline' \
          '--height=60%' \
          '--border=rounded' \
          '--ansi' \
          '--color=fg:#c6d0f7,bg:#303446,hl:#e78284,fg+:#c6d0f7,bg+:#414559,hl+:#a6d189,info:#ca9ee6,prompt:#8caaee,pointer:#f4b8e7,marker:#eebebe,spinner:#ca9ee6,header:#eebebe,gutter:#303446'

        # fzf-tab keybindings: Tab/Shift-Tab to toggle selection, ? or ctrl-/ to toggle preview
        zstyle ':fzf-tab:*' fzf-bindings 'tab:toggle+down' 'btab:toggle+up' '?:toggle-preview' 'ctrl-/:toggle-preview'

        # File & directory preview for common file openers
        zstyle ':fzf-tab:complete:(nvim|vim|nano|bat|cat|less|eza|ls|cd|z|sh|bash):*' fzf-preview \
          'preview "''${(Q)realpath:-''${(Q)word}}"'

        # General file/directory preview when completion context matches files/directories
        zstyle ':fzf-tab:complete:*:*(files|directories)*' fzf-preview \
          'preview "''${(Q)realpath:-''${(Q)word}}"'

        # Process preview for kill/pkill
        zstyle ':fzf-tab:complete:(kill|pkill):argument-rest' fzf-preview \
          'ps --pid=$word -o cmd --no-headers 2>/dev/null'

        # Preview systemctl status only for unit management subcommands (start, stop, restart, status, reload, etc.)
        zstyle ':fzf-tab:complete:systemctl-(start|stop|restart|status|reload|try-restart|enable|disable|mask|unmask|kill|is-active|is-failed):*' fzf-preview \
          'unit="''${word% }"; SYSTEMD_COLORS=1 systemctl status --no-pager "$unit" 2>&1 || SYSTEMD_COLORS=1 systemctl --user status --no-pager "$unit" 2>&1'

        # Preview yay package details for installed and repo/AUR packages
        zstyle ':fzf-tab:complete:yay:*' fzf-preview \
          'pkg="''${word% }"; pacman -Qi "$pkg" 2>/dev/null || yay -Si "$pkg" 2>/dev/null'

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

        # cd: no args -> pick directory via fzf; non-existent path -> fuzzy fzf fallback
        cd() {
          # 1. Non-interactive shell (scripts, subshells, pipelines): use standard builtin cd
          if [[ ! -t 0 || ! -t 1 ]]; then
            builtin cd "$@"
            return
          fi

          # 2. Try standard cd first
          if (( $# > 0 )); then
            builtin cd "$@" 2>/dev/null && return

            # Options / flags (-P, -L) or directory stack (-N, +N, -): pass through to builtin cd
            if [[ "$1" == -* ]]; then
              builtin cd "$@"
              return
            fi
          fi

          local query="$*"
          local dir

          # 3. If query uniquely matches a directory at depth 1 (case-insensitive substring), jump directly
          if [[ -n "$query" ]]; then
            setopt LOCAL_OPTIONS EXTENDED_GLOB
            local -a d1_matches
            d1_matches=( (#i)*"$query"*(N/) )
            if (( ''${#d1_matches[@]} == 1 )); then
              builtin cd -- "''${d1_matches[1]}"
              return
            fi
          fi

          # 4. Check fzf availability
          if ! command -v fzf >/dev/null 2>&1; then
            print -u2 "cd: no such file or directory: $*"
            return 1
          fi

          # 5. Search directories with fd
          local fd_pattern="."
          [[ -n "$query" ]] && fd_pattern="$query"

          local fd_out
          fd_out="$(${pkgs.fd}/bin/fd --max-depth 5 --hidden --type d \
            --exclude .git \
            --exclude node_modules \
            --exclude venv \
            "$fd_pattern" . 2>/dev/null)"

          # If user gave arguments but no directory matched at all, error out without opening fzf
          if [[ -z "$fd_out" ]]; then
            if [[ -n "$query" ]]; then
              print -u2 "cd: no such file or directory: $query"
              return 1
            fi
            return 0
          fi

          # 6. If only 1 directory matched, jump directly without opening fzf
          local -a matches
          matches=( "''${(f)fd_out}" )
          if (( ''${#matches[@]} == 1 )); then
            builtin cd -- "''${matches[1]}"
            return
          fi

          # 7. Multiple matches: open fzf to pick
          dir="$(
            printf '%s\n' "''${matches[@]}" |
            fzf --height=40% --reverse \
              --preview '${pkgs.eza}/bin/eza -la --icons --group-directories-first {} 2>/dev/null'
          )"

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

          # Bind Ctrl+G to navi cheatsheet search (zsh-vi-mode safe)
          _navi_call() {
            local result
            result="$(${pkgs.navi}/bin/navi "$@" </dev/tty)"
            printf "%s" "$result"
          }

          _navi_widget() {
            local -r input="''${LBUFFER}"
            local -r last_command="$(echo "''${input}" | ${pkgs.navi}/bin/navi fn widget::last_command)"
            local replacement

            if [[ -z "$last_command" ]]; then
              replacement="$(_navi_call --print)"
            else
              replacement="$(_navi_call --print --query "$last_command")"
            fi

            # Strip trailing newlines to prevent shell from executing immediately
            replacement="''${replacement%$'\n'}"

            if [[ -n "$replacement" ]]; then
              local -r find="''${last_command}_NAVIEND"
              previous_output="''${input}_NAVIEND"
              previous_output="''${previous_output//$find/$replacement}"
            else
              previous_output="$input"
            fi

            zle kill-whole-line
            LBUFFER="''${previous_output}"
            region_highlight=("P0 100 bold")
            zle redisplay
          }

          zle -N _navi_widget
          zvm_bindkey viins '^G' _navi_widget
          zvm_bindkey vicmd '^G' _navi_widget
          bindkey -M emacs '^G' _navi_widget

          # Bind Ctrl+T to fzf-file-widget (zsh-vi-mode safe)
          zvm_bindkey viins '^T' fzf-file-widget
          zvm_bindkey vicmd '^T' fzf-file-widget
          bindkey -M emacs '^T' fzf-file-widget

          # Alt+Z: zoxide interactive picker via fzf (supports fuzzy matching)
          zoxide-fzf() {
            local dir
            dir="$(
              ${pkgs.zoxide}/bin/zoxide query --list |
              fzf --height=80% --layout=reverse --border=rounded \
                --prompt="󱧖 zoxide ❯ " --pointer=" " --marker=" " \
                --preview-window="down:60%,border-top" \
                --preview='${pkgs.eza}/bin/eza --color=always --icons=always -a --group-directories-first {} 2>/dev/null'
            )" || return
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

          # Smart Streaming Tab Completion for yay (instant fzf UI, continuous stream)
          _yay_smart_tab() {
            local lbuf="''${LBUFFER}"
            local -a tokens
            tokens=(''${(z)lbuf})

            # Only intercept if command starts with yay
            if [[ "''${tokens[1]}" == "yay" ]]; then
              local last_token=""
              if [[ "''${lbuf[-1]}" != " " ]]; then
                last_token="''${tokens[-1]}"
              fi

              # 1. yay -R / -Rs / -Rns: Streaming Remove of installed packages
              if [[ "''${tokens[2]}" == -*R* ]]; then
                if [[ "$last_token" != -* ]]; then
                  local query="''${last_token}"
                  local selected
                  selected=$(
                    pacman -Q --color=never 2>/dev/null |
                      awk '{print $1, $2}' |
                      fzf \
                        --multi \
                        --query="$query" \
                        --prompt="  Remove (yay) > " \
                        --pointer="▶ " \
                        --marker="✓ " \
                        --header="Tab: Select | Enter: Accept | Ctrl-A: All | Ctrl-D: Deselect | Ctrl-/: Preview" \
                        --preview='pacman -Qi {1} 2>/dev/null' \
                        --preview-window="bottom:50%:wrap" \
                        --nth=1 \
                        --height=80% \
                        --bind='ctrl-a:select-all,ctrl-d:deselect-all,ctrl-/:toggle-preview' \
                        --layout=reverse \
                        --border
                  ) || true

                  if [[ -n "$selected" ]]; then
                    local pkgs
                    pkgs=$(echo "$selected" | awk '{print $1}' | tr '\n' ' ' | sed 's/[[:space:]]*$//')
                    if [[ -n "$last_token" ]]; then
                      LBUFFER="''${lbuf%''${last_token}}''${pkgs} "
                    else
                      LBUFFER="''${lbuf}''${pkgs} "
                    fi
                    zle redisplay
                    return 0
                  fi
                  zle redisplay
                  return 0
                fi

              # 2. yay -S / yay <pkg>: Streaming Install of Repo + AUR packages
              elif [[ "''${tokens[2]}" == -*S* || ( "''${tokens[2]}" != -* && ''${#tokens} -ge 1 ) ]]; then
                if [[ "$last_token" != -* ]]; then
                  local query="''${last_token}"
                  local cache_dir="''${XDG_CACHE_HOME:-$HOME/.cache}/yay"
                  local cache_file="''${cache_dir}/completion.cache"

                  # Background refresh if cache is older than 3 days (259200s) or missing
                  local now=$(date +%s)
                  local mtime=$(stat -c %Y "$cache_file" 2>/dev/null || echo 0)
                  if [[ ! -s "$cache_file" ]]; then
                    mkdir -p "$cache_dir" 2>/dev/null
                    yay -Pc > "$cache_file" 2>/dev/null
                  elif (( now - mtime > 259200 )); then
                    ( yay -Pc > "$cache_file" 2>/dev/null ) &!
                  fi

                  local selected
                  selected=$(
                    {
                      if [[ -s "$cache_file" ]]; then
                        awk '{print $2 "\t" $1}' "$cache_file"
                      else
                        yay -Sl --color=never 2>/dev/null | awk '{print $1 "\t" $2}'
                      fi
                    } |
                      fzf \
                        --multi \
                        --query="$query" \
                        --prompt="  Install (yay) > " \
                        --pointer="▶ " \
                        --marker="✓ " \
                        --header="Tab: Select | Enter: Accept | Ctrl-A: All | Ctrl-D: Deselect | Ctrl-/: Preview" \
                        --preview='pacman -Si {2} 2>/dev/null || yay -Si {2} 2>/dev/null' \
                        --preview-window="bottom:50%:wrap" \
                        --nth=2 \
                        --height=80% \
                        --bind='ctrl-a:select-all,ctrl-d:deselect-all,ctrl-/:toggle-preview' \
                        --layout=reverse \
                        --border
                  ) || true

                  if [[ -n "$selected" ]]; then
                    local pkgs
                    pkgs=$(echo "$selected" | awk '{print $2}' | tr '\n' ' ' | sed 's/[[:space:]]*$//')
                    if [[ -n "$last_token" ]]; then
                      LBUFFER="''${lbuf%''${last_token}}''${pkgs} "
                    else
                      LBUFFER="''${lbuf}''${pkgs} "
                    fi
                    zle redisplay
                    return 0
                  fi
                  zle redisplay
                  return 0
                fi
              fi
            fi

            # Fallback to default completion system
            zle fzf-completion
          }
          zle -N _yay_smart_tab
          zvm_bindkey viins '^I' _yay_smart_tab
          zvm_bindkey vicmd '^I' _yay_smart_tab
          bindkey -M emacs '^I' _yay_smart_tab
        }

        function zvm_after_lazy_keybindings() {
          zvm_set_cursor $'\e[6 q'
        }

        # FZF compgen (fd)
        _fzf_compgen_path() {
          ${pkgs.fd}/bin/fd --hidden -t f -E .git -E node_modules -E target -E .venv -E venv . "$1"
        }

        _fzf_compgen_dir() {
          ${pkgs.fd}/bin/fd --hidden -t d -E .git -E node_modules -E target -E .venv -E venv . "$1"
        }

        # FZF-tab completion for dvt
        zstyle ':fzf-tab:complete:dvt:*' fzf-flags \
          '--prompt=dvt > ' \
          '--height=60%' \
          '--reverse'
        typeset -U path
        path=(
          ${systemPathPriorityZsh}
          "$HOME/.local/share/pnpm/bin"
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

        chpwd() {
            p=$PWD:t
        }
      '')

      (lib.mkAfter ''
        # Unload buggy fzf-tab binary module after plugins load (fixes quote evaluation bug in -ftb-generate-complist)
        zmodload -u aloxaf/fzftab >/dev/null 2>&1 || true

        # Carapace completion integration (must run after compinit)
        source <(${pkgs.carapace}/bin/carapace _carapace zsh)
        # Retain zsh native completion
        compdef _systemctl systemctl
        compdef _yay yay
        compdef _sh sh
        compdef _sh bash
        compdef _files nvim vim vi
        zstyle ':fzf-tab:complete:*:*' popup-pad 0 3
      '')
    ];
  };
}
