{ pkgs, ... }:

let
  tmuxAgyHatch = pkgs.writeShellScriptBin "tmux-agy-hatch" (builtins.readFile ./scripts/tmux-agy-hatch.sh);
  tmuxPopupHelper = pkgs.writeShellScriptBin "tmux-popup-helper" (builtins.readFile ./scripts/tmux-popup-helper.sh);
in
{
  home.packages = with pkgs; [
    fzf
    wl-clipboard
    tmuxAgyHatch
    tmuxPopupHelper
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

  programs.zsh.initContent = builtins.readFile ./scripts/zsh-integration.zsh;

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
          set-hook -g client-detached 'run-shell "${pkgs.tmuxPlugins.resurrect}/share/tmux-plugins/resurrect/scripts/save.sh"'
        '';
      }

      {
        plugin = continuum;
        extraConfig = ''
          set -g @continuum-restore 'on'
          set -g @continuum-save-interval '5'
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

        extraConfig = builtins.readFile ./dotbar.conf;
      }
    ];

    extraConfig = builtins.readFile ./tmux.conf;
  };
}
