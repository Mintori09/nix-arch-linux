{ pkgs, config, ... }:
let
  shared = import ../mcp.nix { inherit pkgs config; };

  toOpenCode =
    name: def:
    if def ? remote then
      {
        type = "remote";
        url = def.remote.url;
        timeout = def.remote.timeout or 10000;
        enabled = def.enabled or true;
      }
      // (if def.remote ? headers then { headers = def.remote.headers; } else { })
    else if def ? local then
      {
        type = "local";
        command = def.local.argv;
        env = def.local.env or { };
        enabled = def.enabled or true;
      }
    else
      {
        enabled = false;
      };
in
builtins.mapAttrs toOpenCode shared
