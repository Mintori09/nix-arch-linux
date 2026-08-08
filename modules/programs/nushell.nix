{ pkgs, lib, config, ... }:

{
  programs.nushell = {
    enable = true;
    shellAliases = lib.mkForce { };
    configFile.source = ./nushell/config.nu;
    envFile.source = ./nushell/env.nu;
  };

  programs.starship = {
    enable = true;
    enableNushellIntegration = true;
  };

  programs.carapace = {
    enable = true;
    enableNushellIntegration = true;
  };

  programs.zoxide = {
    enable = true;
    enableNushellIntegration = true;
  };

  home.packages = with pkgs; [
    nushell
    carapace
    starship
    zoxide
  ];
}
