{
  pkgs,
  ...
}:

{
  programs.git = {
    enable = true;
  };

  home.shellAliases = {
    gst = "git status";
  };
}
