{ pkgs, ... }:

{
  home.packages = with pkgs; [
    fzf
    wl-clipboard
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

            # Nếu hash này lỗi, xem phần "Cách lấy hash" bên dưới.
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

                  bind -r S-h previous-window
                  bind -r S-j next-window

                  bind -r C-h select-pane -L
                  bind -r C-j select-pane -D
                  bind -r C-k select-pane -U
                  bind -r C-l select-pane -R

                  bind -r S-h previous-window
                  bind -r S-j next-window

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
                  bind-key -T copy-mode-vi y send -X copy-selection-and-cancel
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
