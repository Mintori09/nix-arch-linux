# home/programs/alacritty.nix
{
  pkgs,
  ...
}:
let
  wrapped = import ./_nixgl-wrappers.nix { inherit pkgs; };

  alacrittyWrapped = wrapped.mkWrappedBinary {
    name = "alacritty";
    package = pkgs.alacritty;
  };
in
{
  programs.alacritty = {
    enable = true;

    package = alacrittyWrapped;

    settings = {
      font = {
        size = 11;
        normal = {
          family = "JetBrainsMonoNL Nerd Font";
        };
      };

      window.opacity = 0.95;

      colors = {
        primary = {
          background = "0x1e1e2e";
          foreground = "0xcdd6f4";
        };

        normal = {
          black = "0x45475a";
          red = "0xf38ba8";
          green = "0xa6e3a1";
          yellow = "0xf9e2af";
          blue = "0x89b4fa";
          magenta = "0xf5c2e7";
          cyan = "0x94e2d5";
          white = "0xbac2de";
        };

        bright = {
          black = "0x585b70";
          red = "0xf38ba8";
          green = "0xa6e3a1";
          yellow = "0xf9e2af";
          blue = "0x89b4fa";
          magenta = "0xf5c2e7";
          cyan = "0x94e2d5";
          white = "0xa6adc8";
        };
      };
    };
  };

  xdg.configFile."alacritty/alacritty.toml".force = true;

  xdg.desktopEntries.alacritty = {
    name = "Alacritty";
    genericName = "Terminal Emulator";
    comment = "Fast, cross-platform, OpenGL terminal emulator";
    exec = "${alacrittyWrapped}/bin/alacritty";
    terminal = false;
    categories = [
      "System"
      "TerminalEmulator"
    ];
    icon = "Alacritty";
    startupNotify = true;
  };
}
