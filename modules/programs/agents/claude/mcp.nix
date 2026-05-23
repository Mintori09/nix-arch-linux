{
  pkgs,
  lib,
  config,
  hostName,
  enableCodex ? false,
}:
let
  shared = import ../mcp.nix { inherit pkgs config; };

  hasLocal = name: def: (def.enabled or true) && def ? local;

  toClaude = name: def: {
    command = builtins.head def.local.argv;
    args = builtins.tail def.local.argv;
    env = def.local.env or { };
  };

  localServers = lib.filterAttrs hasLocal shared;
in
builtins.mapAttrs toClaude localServers
// (
  if enableCodex then
    {
      codex = {
        command = "${pkgs.codex}/bin/codex";
        args = [ "mcp" ];
      };
    }
  else
    { }
)
// (
  if hostName == "work-laptop" then
    {
      work-docs = {
        command = "${pkgs.nodejs}/bin/npx";
        args = [
          "-y"
          "some-work-mcp-server"
        ];
      };
    }
  else
    { }
)
