{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
in
{
  home.packages = helpers.mkScriptPackage {
    name = "vd";
    runtime = "${pkgs.bash}/bin/bash";
    entry = "${../../scripts/execute/select-and-open-video.sh}";
  };
}
