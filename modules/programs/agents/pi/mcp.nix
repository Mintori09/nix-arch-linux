{
  pkgs,
  config,
  lib,
  ...
}:
let
  shared = import ../mcp.nix { inherit pkgs config; };

  # Apify requires APIFY_API_KEY; filter it out if not set to avoid startup warnings in Pi
  enabled = lib.filterAttrs (name: def: (def.enabled or true) && name != "apify") shared;

  toPi =
    name: def:
    if def ? remote then
      {
        url = def.remote.url;
        timeout = (def.remote.timeout or 10000) / 1000;
      }
      // (if def.remote ? headers then { headers = def.remote.headers; } else { })
    else if def ? local then
      {
        command = builtins.head def.local.argv;
        args = builtins.tail def.local.argv;
        env = def.local.env or { };
      }
    else
      { };
in
builtins.mapAttrs toPi enabled
