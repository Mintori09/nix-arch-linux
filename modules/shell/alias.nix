{ pkgs, ... }:

{
  home.shellAliases = {
    # RELOAD CONFIG
    # Lưu ý: Với Home Manager, thường dùng 'hms' (alias bên dưới) thay vì source thủ công
    reload = "source $HOME/.zshrc";
    hms = "home-manager switch --flake ~/.config/home-manager";

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
    cat = "bat";
    history = "fc -l 1";

    # CLIPBOARD (WAYLAND)
    copy = "wl-copy -n";
    pwdc = "pwd | tr -d '\\n' | wl-copy";
    paste = "wl-paste";
    gcl = "qdbus org.kde.klipper /klipper org.kde.klipper.klipper.clearClipboardContents";

    # SYSTEM CONTROL
    st = "systemctl-tui";
    lock = "loginctl lock-session";
    x11 = "env GDK_BACKEND=x11";
    cleantrash = "echo -n \"Taking out the trash...\" | pv -qL 10 && rm -rf $HOME/.local/share/Trash/files && fastfetch";
    remove_pacman_db_lock = "sudo rm /var/lib/pacman/db.lck";
    update-db = "update-desktop-database $HOME/.local/share/applications/";
    set-wifi-priority = "nmcli connection modify $(nmcli -t -f ACTIVE,SSID dev wifi | grep \"^yes\" | cut -d: -f2) connection.autoconnect-priority 100";
    reload-anyrun = "killall -9 anyrun && systemctl --user restart anyrun.service";

    # EDITORS & DOTFILES
    vim = "nvim";
    cfnv = "cd $HOME/.config/nvim && nvim";
    cfz = "cd $HOME/.config/shell && nvim $HOME/.zshrc && source $HOME/.zshrc";
    nf = "nvim $(fzf)";

    # IDEs
    code = "code . && exit";
    zed = "zeditor . && exit";

    # SYNCTHING
    syncthing-config = "nvim $HOME/.local/state/syncthing/config.xml";
    syncthing-web = "xdg-open http://localhost:8384/#";

    # DEVELOPMENT & GIT
    cm = "cargo watch -x build -x test -x run";
    piorun = "pio run -t upload -t monitor";
    tauri-build = "NO_STRP=true pnpm tauri build";

    # TMUX
    t = "tmux attach -t main || tmux new -s main";
    ta = "tmux attach -t";
    tn = "tmux new -s";
    tk = "tmux kill-session -t";
    td = "tmux detach";
    tls = "tmux ls";
    tl = "tmux list-sessions";

    of = "onefetch --disabled-fields description head pending version dependencies authors last-change url churn license --no-art --no-title --no-color-palette";
    vii = "trans -t vi -I";
    tt = "taskwarrior-tui";

    fkill = "ps -ef | fzf | awk '{print $2}' | xargs kill";

    hf = "HISTTIMEFORMAT= history | sed -E 's/^[[:space:]]*[0-9]+\\*?[[:space:]]*//' | fzf --no-sort --tac --no-preview --height=40% --layout=default | wl-copy && echo \"Copied to clipboard: $(wl-paste)\"";

    hfe = "HISTTIMEFORMAT= history | fzf --no-preview --height=40% --reverse --tac | sed -E 's/^[[:space:]]*[0-9]+\\*?[[:space:]]*//' | bash";

    translate = "sh '/home/mintori/Documents/[2] Obsidian/06_Script/Code/Bash/translate novel/translate-novel.sh'";
    kill-antigravity = "killall -9 antigravity";
    kitty = "env FREETYPE_PROPERTIES=\"autofitter:no-stem-darkening=1 cff:no-stem-darkening=1\" kitty";
  };
}
