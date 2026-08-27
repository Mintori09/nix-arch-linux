{ pkgs, ... }:
{
  systemd.user.services.ai-bridge = {
    Unit = {
      Description = "AI Bridge daemon (Gemini clipboard bridge)";
      After = [ "graphical-session.target" ];
      Wants = [ "graphical-session.target" ];
    };

    Service = {
      Type = "simple";
      ExecStart = "${pkgs.ai-bridge}/bin/ai-bridge server";

      Environment = [
        "AI_BRIDGE_PROMPTS_DIR=/home/mintori/Documents/[2] Obsidian/06_Script/Prompt"
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
