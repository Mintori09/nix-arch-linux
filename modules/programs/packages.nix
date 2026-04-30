{
  pkgs,
  spicePkgs,
  ...
}:
let
  wrapped = import ./_nixgl-wrappers.nix { inherit pkgs; };
in

{
  programs.mpv = {
    enable = true;
    package = wrapped.mkWrappedBinary {
      name = "mpv";
      package = pkgs.mpv;
    };
  };

  programs.obsidian = {
    enable = true;
    package = wrapped.mkWrappedBinary {
      name = "obsidian";
      package = pkgs.obsidian;
    };
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
    (wrapped.mkWrappedBinary {
      name = "hoppscotch";
      package = pkgs.hoppscotch;
    })
    (wrapped.mkWrappedBinary {
      name = "nautilus";
      package = pkgs.nautilus;
    })
    (wrapped.mkWrappedBinary {
      name = "vicinae";
      package = pkgs.vicinae;
    })
    (wrapped.mkWrappedBinary {
      name = "gimp";
      package = pkgs.gimp;
    })
  ];
}
