{ config, lib, ... }:
let
  c = import ./_constants.nix;
  home = config.home.homeDirectory;
  pnpmDir = "${home}/.local/share/pnpm";
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
    VISUAL = "nvim";
    TERM = "xterm";
    TERMINAL = "kitty";
    BROWSER = "zen-browser";
    CLIPCOPY = c.clipCopy;
    CLIPPASTE = c.clipPaste;
    ANDROID_HOME = "${home}/Android/Sdk";
    PNPM_HOME = pnpmDir;
    OLLAMA_HOST = "127.0.0.1";
    GTK_USE_PORTAL = "1";
    ZVM_SYSTEM_CLIPBOARD_ENABLED = "true";
    ZVM_CLIPBOARD_COPY_CMD = c.clipCopy;
    ZVM_CLIPBOARD_PASTE_CMD = "${c.clipPaste} -n";
    _JAVA_AWT_WM_NONREPARENTING = "1";
    BAT_THEME = "Catppuccin Frappe";
    RCLONE_LOG_FILE = "${home}/rclone-sync.log";
    GSETTINGS_SCHEMA_DIR = "/usr/share/glib-2.0/schemas";
    QT_QPA_PLATFORM = "wayland";
    QT_QPA_PLATFORMTHEME = "qt6ct";
    FZF_TMUX_OPTS = "-p 90%";
    FZF_COMPLETION_TRIGGER = c.fzfCompletionTrigger;
    FZF_COMPLETION_DIR_OPTS = "--walker dir,follow";
    INTELLI_HOME = c.intelliHome;
    # MANGOHUD = "1";
  };

  home.sessionPath = c.systemPathPriority ++ [
    c.spicetifyPath
    "${home}/.local/bin"
    "${home}/.local/scripts"
    "${home}/bin"
    "${home}/.luarocks/bin"
    "${home}/.config/composer/vendor/bin"
    "${home}/.cargo/bin"
    "${home}/.npm/bin"
    "${home}/.pnpm/bin"
    "$GOBIN"
    "${home}/flutter/bin"
    "${home}/development/flutter/bin"
    "$JAVA_HOME/bin"
    "${pnpmDir}/bin"
    c.intelliHome
    "/usr/lib64/qt5/bin"
  ];
}
