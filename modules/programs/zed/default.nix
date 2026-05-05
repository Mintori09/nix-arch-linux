{
  pkgs,
  spicePkgs,
  ...
}:
{
  programs.zed-editor = {
    enable = false;

    userSettings = import ./_settings.nix;
    userKeymaps = import ./_config.nix;
  };
}
