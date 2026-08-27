{
  pkgs,
  config,
  lib,
  ...
}:
let
  shared = import ../mcp.nix { inherit pkgs config; };

  enabled = lib.filterAttrs (_: def: def.enabled or true) shared;

  toCopilot =
    name: def:
    if def ? remote then
      {
        type = "http";
        url = def.remote.url;
        timeout = def.remote.timeout or 10000;
      }
      // (if def.remote ? headers then { headers = def.remote.headers; } else { })
    else if def ? local then
      {
        type = "local";
        command = builtins.head def.local.argv;
        args = builtins.tail def.local.argv;
        env = def.local.env or { };
      }
    else
      { };
in
builtins.mapAttrs toCopilot enabled
