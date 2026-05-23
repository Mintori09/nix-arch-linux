{
  config,
  pkgs,
  lib,
  hostName,
  ...
}:

let
  mkOutOfStoreSymlink = config.lib.file.mkOutOfStoreSymlink;
  home = config.home.homeDirectory;

  mcpServers = import ./mcp.nix {
    inherit
      pkgs
      lib
      config
      hostName
      ;
    enableCodex = true;
  };

  settings = import ./config.nix { inherit mcpServers; };
in
{
  home.packages = with pkgs; [
    llm-agents.claude-code
    llm-agents.ccusage
  ];

  home.file = {
    # ".claude/CLAUDE.md".source = ../../../config/agents/AGENTS.md;

    ".claude/rules".source = mkOutOfStoreSymlink "${home}/dotfiles/config/agents/rules";
  };

  xdg.configFile."claude/settings.json".text = settings;
}
