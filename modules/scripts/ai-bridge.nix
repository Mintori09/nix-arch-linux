{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };

  aiBridgePackages = helpers.mkScriptPackage {
    name = "ai-bridge";
    entry = "${../../scripts/execute/ai-bridge.js}";
    extraPathPackages = [
      pkgs.nodejs
      pkgs.wl-clipboard
    ];
  };

  aiBridgePkg = builtins.head aiBridgePackages;

  cvCompletion = pkgs.writeTextFile {
    name = "ai-bridge-zsh-completion";
    destination = "/share/zsh/site-functions/_ai-bridge";
    text = ''
      #compdef ai-bridge
      _ai_bridge() {
          local context state line
          typeset -A opt_args
          _arguments -C \
              '1: :->command' \
              '*:: :->args'
          case $state in
              command)
                  local -a subcommands
                  subcommands=(
                      'clipboard:Interact with the system clipboard'
                      'queue:View the current job queue'
                      'clear:Clear all entries from the queue'
                      'status:Check the status of a specific job ID'
                      'stats:View system usage statistics'
                      'health:Check daemon health status'
                      'focus:Focus on the current task'
                      'server:Start the background daemon'
                      'stop:Stop the running daemon'
                  )
                  _describe -t subcommands 'ai-bridge commands' subcommands
                                    
                  _arguments \
                      '-t[Specify a title]:title:_files' \
                      '--ttl[Specify time-to-live in seconds]:ttl:'
                  ;;
              args)
                  case $line[1] in
                      clipboard)
                          _arguments \
                              '--paste-only[Only paste the current content without reading configuration]' \
                              '-t[Specify a title]:title:_files' \
                              '--ttl[Specify time-to-live in seconds]:ttl:'
                          ;;
                      status)
                          _arguments \
                              '1: :_message "job ID"'
                          ;;
                      *)
                          _arguments \
                              '-t[Specify a title]:title:_files' \
                              '--ttl[Specify time-to-live in seconds]:ttl:'
                          ;;
                  esac
                  ;;
          esac
      }
      _ai_bridge "$@"
    '';
  };
in
{
  home.packages = aiBridgePackages ++ [ cvCompletion ];

  systemd.user.services.ai-bridge = {
    Unit = {
      Description = "AI Bridge daemon (Gemini clipboard bridge)";
      After = [ "graphical-session.target" ];
      Wants = [ "graphical-session.target" ];
    };

    Service = {
      Type = "simple";
      ExecStart = "${aiBridgePkg}/bin/ai-bridge server";

      Environment = [
        "AI_BRIDGE_PROMPTS_DIR='/home/mintori/Documents/[2] Obsidian/06_Script/Prompt'"
      ];

      Path = [
        pkgs.wl-clipboard
        pkgs.xdg-utils
        pkgs.kdotool
        pkgs.nodejs
      ];

      Restart = "on-failure";
      RestartSec = 5;
    };

    Install = {
      WantedBy = [ "graphical-session.target" ];
    };
  };
}
