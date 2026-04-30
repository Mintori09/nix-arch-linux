# home/programs/kitty.nix
{
  pkgs,
  ...
}:
let
  wrapped = import ./_nixgl-wrappers.nix { inherit pkgs; };

  kittyWrapped = wrapped.mkWrappedBinary {
    name = "kitty";
    package = pkgs.kitty;
  };
in
{
  programs.kitty = {
    enable = true;
    package = kittyWrapped;

    settings = {
      font_size = 10.0;
      font_family = "family=\"JetBrainsMonoNL Nerd Font\"";
      bold_font = "auto";
      italic_font = "auto";
      bold_italic_font = "auto";

      shell = "zsh";

      cursor = "#b25424";
      cursor_text_color = "#24242e";
      cursor_shape = "block";

      hide_window_decorations = "yes";
      confirm_os_window_close = 0;
      dynamic_background_opacity = "yes";
      active_border_color = "#515167";
      inactive_border_color = "#24242e";
      bell_border_color = "#5151e6";
      wayland_titlebar_color = "#333342";
      macos_titlebar_color = "#333342";

      url_color = "#cecee3";

      active_tab_foreground = "#fbf9f9";
      active_tab_background = "#24242e";
      inactive_tab_foreground = "#b1a9a5";
      inactive_tab_background = "#333342";
      tab_bar_background = "#333342";

      foreground = "#a1a1b5";
      background = "#161e2e";
      selection_foreground = "#a1a1b5";
      selection_background = "#333342";

      mark1_foreground = "#24242e";
      mark1_background = "#6363ee";
      mark2_foreground = "#24242e";
      mark2_background = "#8e8580";
      mark3_foreground = "#24242e";
      mark3_background = "#cb5c25";

      color0 = "#24242e";
      color1 = "#7676f4";
      color2 = "#ec7336";
      color3 = "#fe8c52";
      color4 = "#767693";
      color5 = "#ec7336";
      color6 = "#8a8aad";
      color7 = "#a1a1b5";
      color8 = "#5b5b76";
      color9 = "#f37b3f";
      color10 = "#333342";
      color11 = "#515167";
      color12 = "#737391";
      color13 = "#cecee3";
      color14 = "#e66e33";
      color15 = "#ebebff";
    };

    keybindings = {
      "ctrl+v" = "paste_from_clipboard";
      "ctrl+f3" = "next_tab";
    };

    extraConfig = ''
      text_composition_strategy 2.0 0
    '';
  };

  xdg.configFile."kitty/kitty.conf".force = true;

  xdg.desktopEntries.kitty = {
    name = "kitty";
    genericName = "Terminal Emulator";
    comment = "Fast, feature-rich, GPU based terminal emulator";
    exec = "${kittyWrapped}/bin/kitty";
    terminal = false;
    categories = [
      "System"
      "TerminalEmulator"
    ];
    icon = "kitty";
    startupNotify = true;
  };
}
