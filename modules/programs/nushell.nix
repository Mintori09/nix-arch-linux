{ pkgs, lib, config, ... }:

{
  programs.nushell = {
    enable = true;
    shellAliases = lib.mkForce { };
    configFile = {
      text = ''
        $env.config = {
          show_banner: false
          edit_mode: "vi"
          shell_integration: {
            osc2: true
            osc7: true
            osc133: true
            reset_application_mode: true
          }
        }

        def lsi [] { ls | table --expand --icons }
      '';
    };
  };

  home.packages = with pkgs; [
    nushell
  ];
}
