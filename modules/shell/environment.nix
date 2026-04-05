{ ... }:
{
  home.sessionVariables = {
    LANG = "en_GB.UTF-8";
    LC_ALL = "en_GB.UTF-8";
    EDITOR = "nvim";
    SUDO_EDITOR = "nvim";
    VISUAL = "zeditor";
    TERMINAL = "kitty";
    BROWSER = "zen-browser";
    CLIPCOPY = "wl-copy";
    CLIPPASTE = "wl-paste";
    JAVA_HOME = "/usr/lib/jvm/java-25-openjdk";
    ANDROID_HOME = "$HOME/Android/Sdk";
    PNPM_HOME = "$HOME/.local/share/pnpm";
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
    FZF_COMPLETION_TRIGGER = "*";
    FZF_COMPLETION_DIR_OPTS = "--walker dir,follow";
    INTELLI_HOME = "$HOME/.local/share/intellishell";
    XDG_DATA_DIRS = "$HOME/.nix-profile/share:/usr/share:$XDG_DATA_DIRS";
  };

  home.sessionPath = [
    "$HOME/.local/bin"
    "$HOME/.local/scripts"
    "$HOME/bin"
    "$HOME/.luarocks/bin"
    "$HOME/.spicetify"
    "$HOME/.config/composer/vendor/bin"
    "$HOME/.cargo/bin"
    "$HOME/.npm/bin"
    "$HOME/.pnpm/bin"
    "$GOBIN"
    "$HOME/.pnpm/bin"
    "$HOME/flutter/bin"
    "$HOME/development/flutter/bin"
    "$JAVA_HOME/bin"
    "$PNPM_HOME"
    "$INTELLI_HOME/bin"
    "/usr/lib64/qt5/bin"
  ];
}
