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
      enabled_layouts = "splits,stack";
      font_size = 10.0;
      font_family = "family=\"JetBrainsMonoNL Nerd Font\"";
      bold_font = "auto";
      italic_font = "auto";
      bold_italic_font = "auto";
      hide_window_decorations = "yes";
      confirm_os_window_close = 0;
      dynamic_background_opacity = "yes";
      shell = "zsh";
      background_opacity = "0.9";

      foreground = "#a9b1d6";
      background = "#1a1b26";

      color0 = "#414868";
      color8 = "#414868";

      color1 = "#f7768e";
      color9 = "#f7768e";

      color2 = "#73daca";
      color10 = "#73daca";

      color3 = "#e0af68";
      color11 = "#e0af68";

      color4 = "#7aa2f7";
      color12 = "#7aa2f7";

      color5 = "#bb9af7";
      color13 = "#bb9af7";

      color6 = "#7dcfff";
      color14 = "#7dcfff";

      color7 = "#c0caf5";
      color15 = "#c0caf5";

      cursor = "#c0caf5";
      cursor_text_color = "#1a1b26";

      selection_foreground = "none";
      selection_background = "#28344a";

      url_color = "#9ece6a";

      active_border_color = "#3d59a1";
      inactive_border_color = "#101014";
      bell_border_color = "#e0af68";

      tab_bar_style = "separator";
      tab_fade = 1;
      tab_separator = "";
      tab_bar_min_tabs = 2;
      tab_title_template = "{fmt.fg._5c6370}{fmt.bg._11111b}{fmt.fg._cdd6f4}{fmt.bg._5c6370} ({index}) {title} {fmt.fg._5c6370}{fmt.bg._11111b} ";
      active_tab_title_template = "{fmt.fg._BAA0E8}{fmt.bg._11111b}{fmt.fg._1e1e2e}{fmt.bg._BAA0E8} ({index}) {title} {fmt.fg._BAA0E8}{fmt.bg._11111b} ";
      active_tab_font_style = "bold";
      active_tab_foreground = "#3d59a1";
      active_tab_background = "#16161e";
      inactive_tab_foreground = "#787c99";
      inactive_tab_background = "#16161e";
      inactive_tab_font_style = "bold";
      tab_bar_background = "#101014";

      macos_titlebar_color = "#16161e";

      # cursor = "#b25424";
      # cursor_text_color = "#24242e";
      # cursor_shape = "block";
      #
      #
      # active_border_color = "#515167";
      # inactive_border_color = "#24242e";
      # bell_border_color = "#5151e6";
      # wayland_titlebar_color = "#333342";
      # macos_titlebar_color = "#333342";
      #
      # url_color = "#cecee3";
      #
      # active_tab_foreground = "#fbf9f9";
      # active_tab_background = "#24242e";
      # inactive_tab_foreground = "#b1a9a5";
      # inactive_tab_background = "#333342";
      # tab_bar_background = "#333342";
      #
      # foreground = "#a1a1b5";
      # background = "#161e2e";
      # selection_foreground = "#a1a1b5";
      # selection_background = "#333342";
      #
      # mark1_foreground = "#24242e";
      # mark1_background = "#6363ee";
      # mark2_foreground = "#24242e";
      # mark2_background = "#8e8580";
      # mark3_foreground = "#24242e";
      # mark3_background = "#cb5c25";
      #
      # color0 = "#24242e";
      # color1 = "#7676f4";
      # color2 = "#ec7336";
      # color3 = "#fe8c52";
      # color4 = "#767693";
      # color5 = "#ec7336";
      # color6 = "#8a8aad";
      # color7 = "#a1a1b5";
      # color8 = "#5b5b76";
      # color9 = "#f37b3f";
      # color10 = "#333342";
      # color11 = "#515167";
      # color12 = "#737391";
      # color13 = "#cecee3";
      # color14 = "#e66e33";
      # color15 = "#ebebff";
    };

    keybindings = {
      "ctrl+v" = "paste_from_clipboard";
      "ctrl+f3" = "next_tab";

      "alt+1" = "goto_tab 1";
      "alt+2" = "goto_tab 2";
      "alt+3" = "goto_tab 3";
      "alt+4" = "goto_tab 4";
      "alt+5" = "goto_tab 5";
      "alt+6" = "goto_tab 6";
      "alt+7" = "goto_tab 7";
      "alt+8" = "goto_tab 8";
      "alt+9" = "goto_tab 9";

      "ctrl+shift+t" = "new_tab_with_cwd";
      "ctrl+shift+w" = "close_tab";

      "ctrl+shift+page_up" = "move_tab_backward";
      "ctrl+shift+page_down" = "move_tab_forward";
      "alt+shift+h" = "neighboring_window left";
      "alt+shift+j" = "neighboring_window down";
      "alt+shift+k" = "neighboring_window up";
      "alt+shift+l" = "neighboring_window right";
      "ctrl+shift+enter" = "launch --cwd=current --location=vsplit";
      "ctrl+shift+o" = "launch --type=tab --cwd=current opencode .";
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
