{
  lib,
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

  foliateWrapped = wrapped.mkWrappedBinary {
    name = "foliate";
    package = pkgs.foliate;
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
    foliateWrapped
  ];

  xdg.desktopEntries = {

    mpv = {
      name = "mpv";
      genericName = "Media Player";
      comment = "Lightweight media player";
      exec = "${mpvWrapped}/bin/mpv";
      terminal = false;
      categories = [
        "AudioVideo"
        "Video"
        "Player"
      ];
      icon = "mpv";
      startupNotify = true;
    };

    obsidian = {
      name = "Obsidian";
      genericName = "Knowledge Base";
      comment = "Markdown knowledge base";
      exec = "${obsidianWrapped}/bin/obsidian";
      terminal = false;
      categories = [
        "Office"
        "Utility"
      ];
      icon = "obsidian";
      startupNotify = true;
    };

    hoppscotch = {
      name = "Hoppscotch";
      genericName = "API Client";
      comment = "Open source API development ecosystem";
      exec = "${hoppscotchWrapped}/bin/hoppscotch";
      terminal = false;
      categories = [
        "Development"
        "Network"
      ];
      icon = "hoppscotch";
      startupNotify = true;
    };

    nautilus = {
      name = "Files";
      genericName = "File Manager";
      comment = "Browse files and folders";
      exec = "${nautilusWrapped}/bin/nautilus";
      terminal = false;
      categories = [
        "GNOME"
        "GTK"
        "Core"
        "Utility"
        "FileManager"
      ];
      icon = "org.gnome.Nautilus";
      startupNotify = true;
    };

    vicinae = {
      name = "Vicinae";
      genericName = "Utility";
      comment = "Launch Vicinae through the nixGL wrapper";
      exec = "${vicinaeWrapped}/bin/vicinae";
      terminal = false;
      categories = [ "Utility" ];
      icon = "vicinae";
      startupNotify = true;
    };

    gimp = {
      name = "GIMP";
      genericName = "Image Editor";
      comment = "Create images and edit photographs";
      exec = "${gimpWrapped}/bin/gimp";
      terminal = false;
      categories = [
        "Graphics"
        "2DGraphics"
        "RasterGraphics"
      ];
      icon = "gimp";
      startupNotify = true;
    };

    foliate = {
      name = "Foliate";
      genericName = "E-book Reader";
      comment = "Read EPUB books";
      exec = "${foliateWrapped}/bin/foliate";
      terminal = false;
      categories = [
        "Office"
        "Viewer"
      ];
      icon = "foliate";
      startupNotify = true;
    };
  };

  home.activation.updateDesktopDatabase = lib.hm.dag.entryAfter [ "linkGeneration" ] ''
    if [ -d "$HOME/.nix-profile/share/applications" ]; then
      ${pkgs.desktop-file-utils}/bin/update-desktop-database "$HOME/.nix-profile/share/applications"
    fi

    if [ -d "$HOME/.local/share/applications" ]; then
      ${pkgs.desktop-file-utils}/bin/update-desktop-database "$HOME/.local/share/applications"
    fi
  '';
}
