{ pkgs, ... }:
let
  helpers = import ./_helpers.nix { inherit pkgs; };
  pythonEnv = pkgs.python3.withPackages (
    ps: with ps; [
      requests
      pygments
    ]
  );
in
{
  home.packages = helpers.mkScriptPackage {
    name = "ask";
    runtime = "${pythonEnv}/bin/python";
    entry = "${../../scripts/execute/bash-generation.py}";
  };
}
