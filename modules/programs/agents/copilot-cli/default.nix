{
  config,
  pkgs,
  lib,
  hostName,
  ...
}:
let
  mcpServers = import ./mcp.nix { inherit pkgs lib config; };
in
{
  home.packages = with pkgs; [
    llm-agents.copilot-cli
  ];

  home.file.".copilot/mcp-config.json".text = builtins.toJSON {
    mcpServers = mcpServers;
  };
}
