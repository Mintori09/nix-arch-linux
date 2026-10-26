{
  config,
  pkgs,
  lib,
  ...
}:
let
  mcpServers = import ./mcp.nix { inherit pkgs lib config; };
in
{
  home.packages = with pkgs; [
    llm-agents.pi
  ];

  home.file.".pi/agent/mcp.json".text = builtins.toJSON {
    mcpServers = mcpServers;
  };
}
