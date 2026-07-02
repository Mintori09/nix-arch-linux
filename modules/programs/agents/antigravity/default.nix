{
  pkgs,
  lib,
  config,
  ...
}:

let
  mcpServers = import ./mcp.nix { inherit pkgs config; };

  enabledServers = lib.filterAttrs (name: def: def.enabled or true) mcpServers;

  mcpConfig = {
    mcpServers = builtins.mapAttrs (name: def: removeAttrs def [ "enabled" ]) enabledServers;
  };
in
{
  home.packages = with pkgs; [
    llm-agents.antigravity-cli
  ];

  home.file = {
    ".gemini/antigravity-cli/mcp_config.json" = {
      text = builtins.toJSON mcpConfig;
    };
  };
}
