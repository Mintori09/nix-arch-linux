{ lib, pkgs, ... }:

let
  cargoCompletion = lib.hiPrio (
    pkgs.writeTextFile {
      name = "cargo-zsh-completion";
      destination = "/share/zsh/site-functions/_cargo";
      text = builtins.readFile ./completions/_cargo;
    }
  );
in
{
  home.packages = [ cargoCompletion ];
}
