{ pkgs, ... }:

let
  tmuxAgyHatch = pkgs.writeShellScriptBin "tmux-agy-hatch" ''
    #!/usr/bin/env bash
    set -euo pipefail

    cmd="''${1:-}"

    case "$cmd" in
      launch)
        path="''${2:-$PWD}"
        origin="''${3:-}"
        session="agy-$(echo "$path" | md5sum | cut -c1-8)"

        current_session="$(tmux display-message -p '#{session_name}' 2>/dev/null || true)"
        if [[ "$current_session" == agy-* ]]; then
          tmux display-message "Antigravity popup already open"
          exit 0
        fi

        if ! tmux has-session -t "$session" 2>/dev/null; then
          [ -d "$path" ] || {
            tmux display-message "Directory $path does not exist"
            exit 0
          }
          tmux new-session -d -s "$session" -c "$path" "agy --dangerously-skip-permissions"
        fi

        tmux set-option -t "$session" detach-on-destroy on 2>/dev/null || true
        [ -n "$origin" ] && tmux set-option -t "$session" @agy_origin "$origin" 2>/dev/null || true
        tmux set-option -t "$session" @agy_path "$path" 2>/dev/null || true

        proj_name="$(basename "$path")"
        title=" 󰚩 Antigravity  $proj_name "
        tmux display-popup -w 85% -h 89% -b rounded -T "$title" -E "tmux attach-session -t '$session'"
        ;;

      list)
        sessions="$(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep '^agy-' || true)"
        [ -z "$sessions" ] && exit 0

        while IFS= read -r sess; do
          [ -z "$sess" ] && continue
          pane_id="$(tmux list-panes -t "$sess" -F '#{pane_id}' 2>/dev/null | head -n1)"
          path="$(tmux show-options -qv -t "$sess" @agy_path 2>/dev/null || true)"
          [ -z "$path" ] && path="$(tmux list-panes -t "$sess" -F '#{pane_current_path}' 2>/dev/null | head -n1)"
          origin="$(tmux show-options -qv -t "$sess" @agy_origin 2>/dev/null || true)"

          status="● idle"
          color="\033[32m"
          rank=2

          pane_pid="$(tmux list-panes -t "$sess" -F '#{pane_pid}' 2>/dev/null | head -n1)"
          if pgrep -P "$pane_pid" agy >/dev/null 2>&1 || [ "$(ps -p "$pane_pid" -o comm= 2>/dev/null)" = "agy" ]; then
            tail_text="$(tmux capture-pane -pt "$pane_id" 2>/dev/null | tail -n 12)"
            if echo "$tail_text" | grep -qE "(\?|❯|\[Y/n\]|\(y/n\)|Prompt:|waiting)"; then
              status="● waiting"
              color="\033[33m"
              rank=0
            else
              status="● working"
              color="\033[34m"
              rank=1
            fi
          else
            status="● finished"
            color="\033[90m"
            rank=3
          fi

          proj_name="$(basename "$path")"
          home_path="$path"
          if [[ "$path" == "$HOME"* ]]; then
            home_path="~''${path#$HOME}"
          fi

          printf "%s\t%s\t%s\t%s\t%b%s\033[0m\t%s\t%s\n" \
            "$rank" "$sess" "$pane_id" "$origin" "$color" "$status" "$proj_name" "$home_path"
        done <<< "$sessions" | sort -t$'\t' -k1,1n
        ;;

      picker)
        sessions="$(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep '^agy-' || true)"
        if [ -z "$sessions" ]; then
          tmux display-message "No active Antigravity sessions found"
          exit 0
        fi

        self="$0"
        sel="$("$self" list | fzf \
          --ansi \
          --delimiter='\t' \
          --with-nth=5,6,7 \
          --reverse \
          --cycle \
          --header='󰚩 Antigravity Agents · enter: jump · ctrl-x: kill · esc: quit' \
          --preview='tmux capture-pane -ept {3}' \
          --preview-window='right,65%,follow' \
          --bind="ctrl-x:execute-silent(tmux kill-session -t {2})+reload($self list)" \
        )" || exit 0

        [ -z "$sel" ] && exit 0

        target_sess="$(echo "$sel" | cut -f2)"
        target_origin="$(echo "$sel" | cut -f4)"

        if [ -n "$target_origin" ]; then
          tmux switch-client -t "$target_origin" 2>/dev/null || true
        fi

        tmux attach-session -t "$target_sess"
        ;;

      bell)
        hook_session="''${2:-}"
        case "$hook_session" in
          agy-*)
            origin="$(tmux show-options -qv -t "$hook_session" @agy_origin 2>/dev/null || true)"
            [ -n "$origin" ] || exit 0

            origin_session="$(tmux display-message -p -t "$origin" '#{session_name}' 2>/dev/null || true)"
            [[ "$origin_session" == agy-* ]] && exit 0

            tty="$(tmux display-message -p -t "$origin" '#{pane_tty}' 2>/dev/null || true)"
            [ -n "$tty" ] && printf '\a' > "$tty" 2>/dev/null || true
            ;;
          *)
            exit 0
            ;;
        esac
        ;;

      *)
        echo "Usage: tmux-agy-hatch {launch <path> [origin]|list|picker|bell <session>}"
        exit 1
        ;;
    esac
  '';
in
{
  home.packages = with pkgs; [
    fzf
    wl-clipboard
    tmuxAgyHatch
  ];

  home.shellAliases = {
    # TMUX
    ta = "tmux attach -t";
    tn = "tmux new -s";
    tk = "tmux kill-session -t";
    td = "tmux detach";
    tls = "tmux ls";
    tl = "tmux list-sessions";
  };

  programs.zsh.initContent = ''
    # Attach tmux session with fzf.
    # - 0 session: create/attach "main"
    # - 1 session: attach directly
    # - 2+ sessions: select with fzf
    # - Esc in fzf: do nothing
    t() {
      local sessions count session

      sessions=$(tmux list-sessions 2>/dev/null)
      count=$(printf "%s\n" "$sessions" | sed '/^$/d' | wc -l | tr -d ' ')

      if [ "$count" = "0" ]; then
        tmux new-session -A -s main
      elif [ "$count" = "1" ]; then
        session=$(printf "%s\n" "$sessions" | cut -d: -f1)
        tmux attach-session -t "$session"
      else
        session=$(
          printf "%s\n" "$sessions" |
            fzf \
              --prompt="tmux session> " \
              --reverse \
              --preview='tmux list-windows -t {1} 2>/dev/null' \
              --preview-window=right:60% |
            cut -d: -f1
        )

        [ -n "$session" ] && tmux attach-session -t "$session"
      fi
    }
  '';

  programs.tmux = {
    enable = true;

    shell = "${pkgs.zsh}/bin/zsh";
    terminal = "tmux-256color";

    baseIndex = 1;
    keyMode = "vi";
    mouse = true;
    escapeTime = 0;
    historyLimit = 100000;

    sensibleOnTop = true;

    plugins = with pkgs.tmuxPlugins; [
      sensible
      yank
      tmux-fzf
      vim-tmux-navigator

      {
        plugin = resurrect;
        extraConfig = ''
          set -g @resurrect-capture-pane-contents 'on'
          set -g @resurrect-strategy-vim 'session'
          set -g @resurrect-strategy-nvim 'session'
        '';
      }

      {
        plugin = continuum;
        extraConfig = ''
          set -g @continuum-restore 'on'
          set -g @continuum-save-interval '15'
        '';
      }

      {
        plugin = pkgs.tmuxPlugins.mkTmuxPlugin {
          pluginName = "dotbar";
          version = "0.3.2";

          src = pkgs.fetchFromGitHub {
            owner = "vaaleyard";
            repo = "tmux-dotbar";
            rev = "0.3.2";

            hash = "sha256-WaRKepmPqiE+W8Tm0dBc6hGiqqZP122eXjrG0rJnt0w=";
          };
        };

        extraConfig = ''
          # ---------------------------------------------------------------------
          # tmux-dotbar
          # ---------------------------------------------------------------------

          set -g @tmux-dotbar-bg "#0B0E14"
          set -g @tmux-dotbar-fg "#475266"
          set -g @tmux-dotbar-fg-current "#BFBDB6"
          set -g @tmux-dotbar-fg-session "#565B66"
          set -g @tmux-dotbar-fg-prefix "#95E6CB"

          set -g @tmux-dotbar-position "top"
          set -g @tmux-dotbar-justify "absolute-centre"

          set -g @tmux-dotbar-left "true"
          set -g @tmux-dotbar-right "true"
          set -g @tmux-dotbar-status-right-text " %H:%M "

          set -g @tmux-dotbar-session-position "left"
          set -g @tmux-dotbar-session-text " #S "
          set -g @tmux-dotbar-rounded "true"

          set -g @tmux-dotbar-bold-status "false"
          set -g @tmux-dotbar-bold-current-window "true"

          set -g @tmux-dotbar-window-status-format " #I:#W "
          set -g @tmux-dotbar-window-status-separator " • "

          set -g @tmux-dotbar-maximized-icon "󰊓"
          set -g @tmux-dotbar-show-maximized-icon-for-all-tabs "false"

          set -g @tmux-dotbar-ssh-enabled "true"
          set -g @tmux-dotbar-ssh-icon "󰌘"
          set -g @tmux-dotbar-ssh-icon-only "false"

          set -gq allow-passthrough on
          set -g visual-activity off
          set-option -g focus-events on
        '';
      }
    ];

    extraConfig = ''
                  # ---------------------------------------------------------------------
                  # Core
                  # ---------------------------------------------------------------------
      unbind t

      bind -r t run-shell '\
        SESSION="term-$(echo "#{pane_current_path}" | md5sum | cut -c1-8)"; \
        if [ "#{session_name}" != "$SESSION" ]; then \
          tmux has-session -t "$SESSION" 2>/dev/null || \
          tmux new-session -d -s "$SESSION" -c "#{pane_current_path}"; \
          tmux display-popup -w80% -h89% -E "tmux attach-session -t \"$SESSION\""; \
        fi'
            bind p display-popup -w 100% -h 100% -E '
            tmux list-panes -F "#{pane_id} | #I.#P | #{pane_current_command} | #{pane_current_path}" |
            fzf \
              --delimiter="|" \
              --preview "tmux capture-pane -pt {1}" \
              --preview-window=right:70% |
            cut -d"|" -f1 |
            xargs tmux select-pane -t
            '

                  set -gq allow-passthrough on

                  set -as terminal-features ',xterm-256color:RGB'
                  set -as terminal-features ',tmux-256color:RGB'
                  set -as terminal-features ',*:RGB'

                  set -g renumber-windows on
                  set -g focus-events on

                  setw -g monitor-activity on
                  set -g visual-activity on
                  set -g visual-bell on
                  set -g bell-action other

                  setw -g allow-rename off
                  set -g detach-on-destroy off
                  set -g display-time 4000
                  set -g set-clipboard on

                  # ---------------------------------------------------------------------
                  # Prefix & reload
                  # ---------------------------------------------------------------------

                  unbind C-b

                  set -g prefix C-Space
                  bind C-Space send-prefix
                  bind C-a send-prefix

                  bind r source-file -q ~/.config/tmux/tmux.conf \; display-message "tmux.conf reloaded"

                  # ---------------------------------------------------------------------
                  # Pane navigation / resize
                  # ---------------------------------------------------------------------

                  # Chuyển focus giữa các tab / window (Trái / Phải)
                  bind -r Left previous-window
                  bind -r Right next-window
                  bind -r S-h previous-window
                  bind -r S-l next-window

                  bind -r C-h select-pane -L
                  bind -r C-j select-pane -D
                  bind -r C-k select-pane -U
                  bind -r C-l select-pane -R

                  bind -r h resize-pane -L 5
                  bind -r j resize-pane -D 5
                  bind -r k resize-pane -U 5
                  bind -r l resize-pane -R 5

                  bind v split-window -h -c "#{pane_current_path}"
                  bind s split-window -v -c "#{pane_current_path}"
                  bind y setw synchronize-panes

                  # ---------------------------------------------------------------------
                  # Session / window workflow
                  # ---------------------------------------------------------------------

                  bind C new-session
                  bind w new-window -c "#{pane_current_path}"
                  bind o choose-tree -Zw

                  bind x kill-pane
                  bind X kill-window
                  bind D detach-client

                  bind -r ^ last-window

                  bind , command-prompt -I "#W" "rename-window '%%'"
                  bind '$' command-prompt -I "#S" "rename-session '%%'"

                  # ---------------------------------------------------------------------
                  # Copy mode - Vim style
                  # ---------------------------------------------------------------------

                  bind [ copy-mode

                  bind-key -T copy-mode-vi v send -X begin-selection
                  bind-key -T copy-mode-vi C-v send -X rectangle-toggle
                  bind-key -T copy-mode-vi y send -X copy-pipe-and-cancel "wl-copy --trim-newline"
                  bind-key -T copy-mode-vi Escape send -X cancel

                  # ---------------------------------------------------------------------
                  # FZF helpers
                  # ---------------------------------------------------------------------

                  bind-key ? display-popup -E 'tmux list-keys | fzf --reverse --ansi --preview "echo {}" | cut -f 2 | xargs -I % tmux display-message "%"'

                  bind W display-popup -w 100% -h 100% -E '\
                    tmux list-windows -a -F "#{session_name}:#{window_index}|#{window_name}|#{window_layout}" | \
                    fzf --reverse --header " switch window " \
                      --delimiter="|" \
                      --preview "tmux capture-pane -pt {1}.0" \
                      --preview-window=right:70% | \
                    cut -d"|" -f1 | tr -d " " | \
                    xargs tmux select-window -t'

                  bind S display-popup -w 100% -h 100% -E '\
                    tmux list-sessions -F "#{session_name} | #{session_windows} windows" | \
                    fzf --reverse --header " switch session " | \
                    cut -d"|" -f1 | tr -d " " | \
                    xargs tmux switch-client -t'

                  # ---------------------------------------------------------------------
                  # Popups
                  # ---------------------------------------------------------------------

                  bind -r g display-popup -d '#{pane_current_path}' -w80% -h80% -E lazygit

                  # Antigravity Hatch (Launch/Attach, Picker & Bell Forwarding)
                  bind -r a run-shell '${tmuxAgyHatch}/bin/tmux-agy-hatch launch "#{pane_current_path}" "#{window_id}"'
                  bind -r A display-popup -w 85% -h 89% -b rounded -T " 󰚩 Antigravity Agents " -E "${tmuxAgyHatch}/bin/tmux-agy-hatch picker"
                  bind -r u display-popup -w 85% -h 89% -b rounded -T " 󰚩 Antigravity Agents " -E "${tmuxAgyHatch}/bin/tmux-agy-hatch picker"

                  set-hook -g alert-bell "run-shell -b '${tmuxAgyHatch}/bin/tmux-agy-hatch bell #{q:hook_session_name}'"
                  bind -r y run-shell '\
                    SESSION="opencode-$(echo "#{pane_current_path}" | md5sum | cut -c1-8)"; \
                    if [ "#{session_name}" != "$SESSION" ]; then \
                      tmux has-session -t "$SESSION" 2>/dev/null || \
                      tmux new-session -d -s "$SESSION" -c "#{pane_current_path}" "opencode"; \
                      tmux display-popup -w80% -h89% -E "tmux attach-session -t \"$SESSION\""; \
                    fi'
                  bind -r P run-shell '\
                    SESSION="pi-$(echo "#{pane_current_path}" | md5sum | cut -c1-8)"; \
                    if [ "#{session_name}" != "$SESSION" ]; then \
                      tmux has-session -t "$SESSION" 2>/dev/null || \
                      tmux new-session -d -s "$SESSION" -c "#{pane_current_path}" "pi"; \
                      tmux display-popup -w80% -h89% -E "tmux attach-session -t \"$SESSION\""; \
                    fi'

                  # ---------------------------------------------------------------------
                  # Appearance not managed by dotbar
                  # ---------------------------------------------------------------------

                  set -g pane-border-style "fg=red,bg=default"
                  set -g pane-active-border-style "fg=green,bg=default"

                  set -g window-status-current-format \
                    "#[bg=#1E2633,fg=#BFBDB6,bold] #I:#W \
                     #[fg=#39BAE6,bg=#1E2633]#{?window_zoomed_flag,󰊓,}\
                     #[fg=#1E2633,bg=default]"

                  setw -g mode-style "bg=black,fg=colour154"
    '';
  };
}
