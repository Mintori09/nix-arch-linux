{
  config,
  lib,
  noughtyLib,
  ...
}:
{
  programs = {
    atuin = {
      enable = true;
      enableBashIntegration = config.programs.bash.enable;
      enableFishIntegration = config.programs.fish.enable;
      enableZshIntegration = config.programs.zsh.enable;
      flags = [ "--disable-up-arrow" ];
      settings = {
        auto_sync = true;
        sync_frequency = "5m";
        update_check = false;
        sync.records = true;
        dotfiles.enabled = false;
      };
    };
  };
}
