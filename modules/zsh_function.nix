{ pkgs, lib, ... }:

let
  functionsDir = ../scripts/zsh_function;

  allFunctions =
    let
      files = builtins.readDir functionsDir;
      fileContents = lib.mapAttrsToList (
        name: type:
        if type == "regular" && lib.hasSuffix ".sh" name then
          builtins.readFile (functionsDir + "/${name}")
        else
          ""
      ) files;
    in
    lib.concatStringsSep "\n" fileContents;
in
{
  programs.zsh = {
    enable = true;
    initContent = allFunctions;
  };
}
