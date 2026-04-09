{ pkgs, ... }:
let
  pythonEnv = pkgs.python3.withPackages (
    ps: with ps; [
      requests
      pygments
    ]
  );

  script = pkgs.writeShellScriptBin "ask" ''
    exec ${pythonEnv}/bin/python "${../../scripts/execute/bash-generation.py}" "$@"
  '';
in
{
  home.packages = [ script ];
}
