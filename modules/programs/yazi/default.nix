{
  pkgs,
  config,
  lib,
  ...
}:
let
  # Wrapper script that launches Yazi inside a floating Kitty window as a file picker
  yaziPicker = pkgs.writeShellScriptBin "yazi-picker" ''
    set -eu
    OUTPUT_FILE="''${1:-}"
    DEFAULT_DIR="''${2:-$HOME}"

    if [ -z "$OUTPUT_FILE" ]; then
      OUTPUT_FILE="$(mktemp -t yazi-selected-XXXXXX)"
      kitty --class yazi-filepicker -e ${pkgs.yazi}/bin/yazi "$DEFAULT_DIR" --chooser-file="$OUTPUT_FILE"
      if [ -s "$OUTPUT_FILE" ]; then
        cat "$OUTPUT_FILE"
      fi
      rm -f "$OUTPUT_FILE"
    else
      kitty --class yazi-filepicker -e ${pkgs.yazi}/bin/yazi "$DEFAULT_DIR" --chooser-file="$OUTPUT_FILE"
    fi
  '';
in
{
  home.packages = [
    yaziPicker
  ];

  programs.yazi = {
    enable = true;
    enableZshIntegration = true;
    enableNushellIntegration = true;
    shellWrapperName = "y";

    settings = {
      manager = {
        show_hidden = true;
        sort_by = "alphabetical";
        sort_sensitive = false;
        sort_reverse = false;
        sort_dir_first = true;
        linemode = "size";
      };
      opener = {
        edit = [
          {
            run = ''$EDITOR "$@"'';
            block = true;
            for = "unix";
          }
        ];
        open = [
          {
            run = ''xdg-open "$@"'';
            desc = "Open with default app";
          }
        ];
      };
    };

    plugins = {
      office = pkgs.fetchFromGitHub {
        owner = "macydnah";
        repo = "office.yazi";
        rev = "41ebef8be9dded98b5179e8af65be71b30a1ac4d";
        hash = "sha256-QFto48D+Z8qHl7LHoDDprvr5mIJY8E7j37cUpRjKdNk=";
      };
    };
  };

  # Config for xdg-desktop-portal-termfilechooser (if installed)
  xdg.configFile."xdg-desktop-portal-termfilechooser/config".text = ''
    [filechooser]
    cmd=${yaziPicker}/bin/yazi-picker
    default_dir=$HOME
    open_mode=suggested
    save_mode=last
  '';

  # Desktop entry so system & GUI apps recognize Yazi as a file manager
  xdg.desktopEntries.yazi = {
    name = "Yazi";
    genericName = "File Manager";
    comment = "Blazing fast terminal file manager";
    icon = "system-file-manager";
    exec = "kitty -e ${pkgs.yazi}/bin/yazi %u";
    terminal = false;
    categories = [
      "System"
      "FileManager"
      "Utility"
      "Core"
    ];
    mimeType = [
      "inode/directory"
      "application/x-directory"
    ];
  };

  # Set Yazi as the default handler for directories
  xdg.mimeApps = {
    enable = true;
    defaultApplications = {
      "inode/directory" = [ "yazi.desktop" ];
      "application/x-directory" = [ "yazi.desktop" ];
    };
  };

  # Also update KDE Plasma and XDG default file manager settings
  home.activation.setKdeFileManager = config.lib.dag.entryAfter [ "writeBoundary" ] ''
    if [ -x "$(command -v xdg-mime)" ]; then
      xdg-mime default yazi.desktop inode/directory 2>/dev/null || true
      xdg-mime default yazi.desktop application/x-directory 2>/dev/null || true
    fi

    if [ -x "$(command -v kwriteconfig6)" ]; then
      kwriteconfig6 --file kdeglobals --group General --key FileManager "yazi.desktop" 2>/dev/null || true
    elif [ -x "$(command -v kwriteconfig5)" ]; then
      kwriteconfig5 --file kdeglobals --group General --key FileManager "yazi.desktop" 2>/dev/null || true
    fi
  '';

  programs.zsh = {
    initContent = ''
      function y() {
        local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
        command yazi "$@" --cwd-file="$tmp"
        IFS= read -r -d ''' cwd < "$tmp"
        [ "$cwd" != "$PWD" ] && [ -d "$cwd" ] && builtin cd -- "$cwd"
        rm -f -- "$tmp"
      }
    '';
  };
}
