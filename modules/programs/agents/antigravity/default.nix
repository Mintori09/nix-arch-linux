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

  agyCompletion = pkgs.writeTextFile {
    name = "agy-zsh-completion";
    destination = "/share/zsh/site-functions/_agy";
    text = builtins.readFile ../../../scripts/completions/_agy;
  };
in
{
  home.packages = with pkgs; [
    llm-agents.antigravity-cli
    agyCompletion
  ];

  home.file = {
    ".gemini/antigravity-cli/mcp_config.json" = {
      text = builtins.toJSON mcpConfig;
    };
  };
}
