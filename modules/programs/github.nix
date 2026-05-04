{
  config,
  lib,
  pkgs,
  ...
}:

{
  programs.gh = {
    enable = true;
    gitCredentialHelper.enable = false;
    settings = {
      git_protocol = "ssh";
      user = "Mintori09";
      aliases = {
        co = "pr checkout";
        pv = "pr view";
      };
    };
  };
}
