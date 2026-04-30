{
  pkgs,
  spicePkgs,
  ...
}:
let
  wrapped = import ./_nixgl-wrappers.nix { inherit pkgs; };

  mpvWrapped = wrapped.mkWrappedBinary {
    name = "mpv";
    package = pkgs.mpv;
  };

  obsidianWrapped = wrapped.mkWrappedBinary {
    name = "obsidian";
    package = pkgs.obsidian;
  };

  hoppscotchWrapped = wrapped.mkWrappedBinary {
    name = "hoppscotch";
    package = pkgs.hoppscotch;
  };

  nautilusWrapped = wrapped.mkWrappedBinary {
    name = "nautilus";
    package = pkgs.nautilus;
  };

  vicinaeWrapped = wrapped.mkWrappedBinary {
    name = "vicinae";
    package = pkgs.vicinae;
  };

  gimpWrapped = wrapped.mkWrappedBinary {
    name = "gimp";
    package = pkgs.gimp;
  };
in

{
  programs.mpv = {
    enable = true;
    package = mpvWrapped;
  };

  programs.obsidian = {
    enable = true;
    package = obsidianWrapped;
  };

  programs.spicetify = {
    enable = true;

    theme = spicePkgs.themes.catppuccin;
    colorScheme = "mocha";

    enabledExtensions = with spicePkgs.extensions; [
      adblockify
      hidePodcasts
      shuffle
    ];
  };

  home.packages = [
    hoppscotchWrapped
    nautilusWrapped
    vicinaeWrapped
    gimpWrapped
  ];
}
