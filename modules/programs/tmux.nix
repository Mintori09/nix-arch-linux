{ pkgs, ... }:

{
  programs.tmux = {
    enable = true;

    shell = "${pkgs.zsh}/bin/zsh";
    terminal = "xterm-256color";

    baseIndex = 1;
    keyMode = "vi";
    mouse = true;
    escapeTime = 0;

    extraConfig = ''
      # 🧰 Core Settings
      set -gq allow-passthrough on
      set -g visual-activity off
      set -g default-terminal "xterm-256color"
      set -ag terminal-overrides ",xterm-256color:RGB"

      setw -g monitor-activity on
      set -g visual-activity on
      set -g visual-bell on
      set -g bell-action other

      set -g renumber-windows on

      # 🔑 Prefix & Keybindings

      unbind C-b
      set -g prefix C-Space
      bind C-Space send-prefix

      bind r source-file ~/.config/tmux/tmux.conf \; display "🔁 Reloaded!"

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

      bind -r ^ last-window

      bind-key ? display-popup -E 'tmux list-keys | fzf --reverse --ansi --preview "echo {}" | cut -f 2 | xargs -I % tmux display-message "%"'

      # 🧭 Appearance

      set -g pane-border-style "fg=red,bg=default"
      set -g pane-active-border-style "fg=green,bg=default"

      setw -g mode-style "bg=black,fg=colour154"

      set -g status-position bottom
      set -g status-justify centre
      set -g status-bg black
      set -g status-left-length 100
      set -g status-right-length 100
      setw -g window-status-separator \'\'

      # 🎨 Statusline Theme

      set -g status-left '#[fg=white,bg=blue]  #{cursor_x},#{cursor_y} #[fg=blue,bg=green]#[fg=black,bg=green] #S #{prefix_highlight} #[fg=green,bg=black] #W #(whoami)  CPU: #{cpu_percentage}  Online:#{online_status}'

      set -g status-right '#[fg=white,bg=black]Bat: #{battery_percentage} #[fg=blue,bg=black]#[fg=white,bg=blue]Continuum:#{continuum_status} #[fg=blue,bg=white]#{vm_status} #[fg=white,bg=black]#{docker_status}'
    '';

    plugins = with pkgs.tmuxPlugins; [
      sensible
      yank
      prefix-highlight
      tmux-fzf
      resurrect
      continuum
      vim-tmux-navigator
      cpu
      battery
      online-status

      {
        plugin = pkgs.tmuxPlugins.mkTmuxPlugin {
          pluginName = "tmux-docker-status";
          version = "latest";
          src = pkgs.fetchFromGitHub {
            owner = "stonevil";
            repo = "tmux-docker-status";
            rev = "606c7af";
            sha256 = "0qypssgzmrw5n9pikyji8ny7mz0jam0352fqcz2jicdvynk1mnbk";
          };
        };
      }

      # {
      #   plugin = pkgs.tmuxPlugins.mkTmuxPlugin {
      #     pluginName = "tmux-fingers";
      #     version = "latest";
      #     src = pkgs.fetchFromGitHub {
      #       owner = "Morantron";
      #       repo = "tmux-fingers";
      #       rev = "master";
      #       sha256 = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
      #     };
      #   };
      # }

      {
        plugin = pkgs.tmuxPlugins.mkTmuxPlugin {
          pluginName = "tmux-split-statusbar";
          version = "latest";
          src = pkgs.fetchFromGitHub {
            owner = "charlietag";
            repo = "tmux-split-statusbar";
            rev = "33a367b";
            sha256 = "1ds5910s5wkp4r84qp7rd704shwil0q3h7yaqd2lfif75jw9s37x";
          };
        };
      }
    ];
  };
}
