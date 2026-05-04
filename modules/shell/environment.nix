{ config, lib, ... }:
let
  c = import ./_constants.nix;
in
{
  xdg.systemDirs.data = lib.mkForce (
    c.systemDataPriority
    ++ [
      "\${NIX_STATE_DIR:-/nix/var/nix}/profiles/default/share"
      "${config.home.profileDirectory}/share"
    ]
  );

  home.sessionVariables = {
    LANG = "en_GB.UTF-8";
    LC_ALL = "en_GB.UTF-8";
    EDITOR = "nvim";
    SHELL = "zsh";
    XMODIFIERS = "@im=fcitx";
    GLFW_IM_MODULE = "ibus";
    SUDO_EDITOR = "nvim";
    VISUAL = "zeditor";
    TERM = "xterm-256color";
    TERMINAL = "kitty";
    BROWSER = "zen-browser";
    CLIPCOPY = c.clipCopy;
    CLIPPASTE = c.clipPaste;
    ANDROID_HOME = "$HOME/Android/Sdk";
    PNPM_HOME = c.pnpmHome;
    OLLAMA_HOST = "127.0.0.1";
    GTK_USE_PORTAL = "1";
    ZVM_SYSTEM_CLIPBOARD_ENABLED = "1";
    _JAVA_AWT_WM_NONREPARENTING = "1";
    BAT_THEME = "Catppuccin Frappe";
    RCLONE_LOG_FILE = "$HOME/rclone-sync.log";
    GSETTINGS_SCHEMA_DIR = "/usr/share/glib-2.0/schemas";
    QT_QPA_PLATFORM = "wayland";
    QT_QPA_PLATFORMTHEME = "qt6ct";
    FZF_TMUX_OPTS = "-p 90%";
    FZF_COMPLETION_TRIGGER = c.fzfCompletionTrigger;
    FZF_COMPLETION_DIR_OPTS = "--walker dir,follow";
    INTELLI_HOME = c.intelliHome;
  };

  home.sessionPath = c.systemPathPriority ++ [
    c.spicetifyPath
    "$HOME/.local/bin"
    "$HOME/.local/scripts"
    "$HOME/bin"
    "$HOME/.luarocks/bin"
    "$HOME/.config/composer/vendor/bin"
    "$HOME/.cargo/bin"
    "$HOME/.npm/bin"
    "$HOME/.pnpm/bin"
    "$GOBIN"
    "$HOME/flutter/bin"
    "$HOME/development/flutter/bin"
    "$JAVA_HOME/bin"
    "$PNPM_HOME"
    "$INTELLI_HOME/bin"
    "/usr/lib64/qt5/bin"
  ];
}
