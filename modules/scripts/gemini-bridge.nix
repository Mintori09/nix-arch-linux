{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "gemini-bridge";
    entry = "${../../scripts/execute}/gemini-bridge.ts";
  };
}
