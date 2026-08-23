{ pkgs, ... }:
let
  c = import ./_constants.nix;
in

{
  home.shellAliases = {
    # RELOAD CONFIG
    # aider = "aider --model opencode-go/glm-5.1 --watch-files --no-auto-commits --no-show-model-warnings";
    # opencode-go/deepseek-v4-pro
    reload = "source $HOME/.config/zsh/.zshrc";
    hms = "home-manager switch --flake ~/.config/home-manager -j 1";
    update-packages = "yay -Syu --ignore voxtype-cuda";

    # NAVIGATION & SHELL BASICS
    ".." = "cd ..";
    ".2" = "cd ..";
    "..." = "cd ../..";
    ".3" = "cd ../..";
    ".4" = "cd ../../..";
    de = "cd $HOME/Desktop";
    prj = "cd ~/Projects";
    c = "clear";

    # MODERN REPLACEMENTS
    history = "fc -l 1";

    # CLIPBOARD (WAYLAND)
    copy = "${c.clipCopy} -n";
    paste = c.clipPaste;

    # SYSTEM CONTROL
    lock = "loginctl lock-session";
    x11 = "env GDK_BACKEND=x11";
    remove_pacman_db_lock = "sudo rm /var/lib/pacman/db.lck";
    update-db = "update-desktop-database $HOME/.local/share/applications/";

    # EDITORS & DOTFILES
    vim = "nvim";
    cfnv = "cd $HOME/.config/nvim; nvim";
    cfz = "cd $HOME/.config/shell; nvim $HOME/.zshrc; source $HOME/.zshrc";

    # IDEs
    zed = "zeditor .; exit";

    # SYNCTHING
    syncthing-config = "nvim $HOME/.local/state/syncthing/config.xml";
    syncthing-web = "xdg-open http://localhost:8384/#";
    xdgo = "xdg-open";

    # DEVELOPMENT & GIT
    cm = "cargo watch -x build -x test -x run";
    piorun = "pio run -t upload -t monitor";
    tauri-build = "NO_STRP=true pnpm tauri build";

    of = "onefetch --disabled-fields description head pending version dependencies authors last-change url churn license --no-art --no-title --no-color-palette";
    vii = "trans -t vi -I";
    tt = "taskwarrior-tui";

    hf = "HISTTIMEFORMAT= history | sed -E 's/^[[:space:]]*[0-9]+\\*?[[:space:]]*//' | fzf --no-sort --tac --no-preview --height=40% --layout=default | wl-copy; echo \"Copied to clipboard: $(wl-paste)\"";

    hfe = "HISTTIMEFORMAT= history | fzf --no-preview --height=40% --reverse --tac | sed -E 's/^[[:space:]]*[0-9]+\\*?[[:space:]]*//' | bash";
    navicat = "QT_QPA_PLATFORM=xcb navicatQT_QPA_PLATFORM=xcb navicat";
    co = "wl-copy";
    cat = "bat";
    torlink = "npx torlnk";
    nls = "nu -c ls";
    l = "nu -c 'ls | sort-by type | table --expand --icons'";
    packettracer = "~/.local/bin/packettracer";
    gdc = "git diff | wl-copy";
    catc = "cpath --content";
    cpf = "fzf | each --batch cpath";
  };

  programs.bash = {
    shellAliases.hms = "home-manager switch --flake ~/.config/home-manager -j 1";
  };
}
