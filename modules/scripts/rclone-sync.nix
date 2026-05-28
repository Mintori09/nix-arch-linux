{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "rclone-sync";
    entry = "${../../scripts/execute/rclone-sync.ts}";
    extraPathPackages = [ pkgs.rclone ];
  };
}
