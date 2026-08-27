{ pkgs, config, ... }:
let
  shared = import ../mcp.nix { inherit pkgs config; };

  toAntigravity =
    name: def:
    if def ? remote then
      {
        serverUrl = def.remote.url;
        timeout = def.remote.timeout or 10000;
        enabled = def.enabled or true;
      }
      // (if def.remote ? headers then { headers = def.remote.headers; } else { })
    else if def ? local then
      {
        command = builtins.head def.local.argv;
        args = builtins.tail def.local.argv;
        env = def.local.env or { };
        enabled = def.enabled or true;
      }
    else
      {
        enabled = false;
      };
in
builtins.mapAttrs toAntigravity shared
