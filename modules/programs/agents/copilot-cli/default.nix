{
  config,
  pkgs,
  lib,
  hostName,
  ...
}:
{
  home.packages = with pkgs; [
    llm-agents.copilot-cli
  ];

}
