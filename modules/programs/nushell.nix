{ pkgs, lib, config, inputs, ... }:

{
  programs.nushell = {
    enable = true;
    shellAliases = lib.mkForce { };
    configFile.source = ./nushell/config.nu;
    envFile.source = ./nushell/env.nu;
  };

  xdg.configFile."nushell/nu_scripts".source = inputs.nu-scripts;

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
    direnv
  ];
}
