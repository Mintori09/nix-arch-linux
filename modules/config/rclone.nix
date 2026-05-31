{ ... }:

{
  home.file = {
    ".config/rclone/filter/config.txt".text = ''
      # ============================================
      # Rclone filter - synced to cloud via rclone
      # Managed by Nix home-manager
      # ============================================

      # === EXCLUDE: Caches & runtime ===
      - .cache/**
      - **/Cache/**
      - **/GPUCache/**
      - **/Code Cache/**
      - .aider*
      - **/blob_storage/**
      - **/DawnGraphiteCache/**
      - **/DawnWebGPUCache/**
      - **/Session Storage/**
      - **/Local Storage/**
      - **/Dictionaries/**
      - **/Crashpad/**
      - **/node_modules/**
      - **/DIPS*
      - **/Cookies*
      - **/Trust Tokens*
      - **/Shared Dictionary*
      - **/SharedStorage*
      - **/TransportSecurity*
      - **/Network Persistent State*
      - **/WebStorage/**
      - **/IndexedDB/**
      - **/Service Worker/**
      - **/VideoDecodeStats/**
      - **/logs/**
      - **/sentry/**
      - **/Singleton*
      - **/Preferences
      - **/user-dirs.dirs
      - **/user-dirs.locale

      # === EXCLUDE: Large data dirs ===
      - Documents/**
      - Downloads/**
      - .cargo/**
      - .local/share/Trash/**
      - *.bak
      - *.log
      - .config/anyrun/plugins/**
      - .config/anyrun/anyrun-favicons/**

      # === EXCLUDE: Secrets ===
      - .config/rclone/rclone.conf
      - .config/gh/hosts.yml
      - .config/kdeconnect/*.pem
      - .config/Proton/**

      # === EXCLUDE: Electron/browser app data ===
      - .config/Antigravity/**
      - .config/Bitwarden/**
      - .config/BraveSoftware/**
      - .config/zen/**
      - .config/Code/**
      - .config/Folo/**
      - .config/google-chrome/**
      - .config/marktext/**
      - .config/obsidian/**
      - .config/openscreen/**
      - .config/pomatez/**
      - .config/Signal/**
      - .config/Slack/**
      - .config/superProductivity/**
      - .config/Todoist/**
      - .config/Typora/**
      - .config/com.differentai.openwork/**
      - .config/Sigma file manager/**
      - .config/YouTube Music/**
      - .config/waveterm/**
      - .config/openwarp/**
      - .config/noctalia/**

      # === EXCLUDE: Already managed by Nix ===
      - .config/alacritty/alacritty.toml
      - .config/bat/config
      - .config/claude/settings.json
      - .config/environment.d/**
      - .config/fastfetch/config.jsonc
      - .config/fish/config.fish
      - .config/gh/config.yml
      - .config/git/config
      - .config/helix/config.toml
      - .config/helix/languages.toml
      - .config/kitty/diff.conf
      - .config/kitty/kitty.conf
      - .config/nushell/config.nu
      - .config/oc-go-cc/config.json
      - .config/opencode/config.json
      - .config/opencode/opencode-notifier.json
      - .config/pandoc/defaults.yaml
      - .config/qutebrowser/config.py
      - .config/television/config.toml
      - .config/tmux/tmux.conf
      - .config/yazi/yazi.toml
      - .config/yt-dlp/config
      - .config/9router/docker-compose.yml

      # ============================================
      # INCLUDE: Editor / IDE
      # ============================================
      + .config/nvim/**
      + .config/zed/settings.json
      + .config/zed/keymap.json

      # ============================================
      # INCLUDE: App launcher
      # ============================================
      + .config/anyrun/**
      + .config/rofi/**

      # ============================================
      # INCLUDE: Input method
      # ============================================
      + .config/fcitx5/**

      # ============================================
      # INCLUDE: Media
      # ============================================
      + .config/mpv/**
      + .config/haruna/**

      # ============================================
      # INCLUDE: KDE
      # ============================================
      + .config/kdeglobals
      + .config/kwinrc
      + .config/kwinoutputconfig.json
      + .config/plasmarc
      + .config/plasmashellrc
      + .config/powerdevilrc
      + .config/plasma-org.kde.plasma.desktop-appletsrc
      + .config/breezerc
      + .config/dolphinrc
      + .config/kglobalshortcutsrc
      + .config/klipperrc
      + .config/konsolerc
      + .config/ksmserverrc
      + .config/kxkbrc
      + .config/katerc
      + .config/kate/externaltools/**
      + .config/Kvantum/kvantum.kvconfig
      + .config/spectaclerc
      + .config/kdedefaults/**

      # ============================================
      # INCLUDE: GTK
      # ============================================
      + .config/gtk-3.0/settings.ini
      + .config/gtk-4.0/settings.ini
      + .config/gtkrc
      + .config/gtkrc-2.0

      # ============================================
      # INCLUDE: System tools
      # ============================================
      + .config/lazygit/**
      + .config/lazydocker/**
      + .config/btop/btop.conf
      + .config/bottom/bottom.toml
      + .config/glow/glow.yml
      + .config/yazi/keymap.toml
      + .config/yazi/theme.toml
      + .config/obs-studio/**

      # ============================================
      # INCLUDE: Personal / custom apps
      # ============================================
      + .config/keyboard-rs/**
      + .config/mintori/**
      + .config/konsave/**
      + .config/autostart/**
      + .config/renameflow/**
      + .config/news-flash/**
      + .config/novella/config.json
      + .config/notify-bot-dut/config.json
      + .config/sioyek/**
      + .config/vicinae/settings.json
      + .config/voxtype/config.toml
      + .config/rtk/config.toml
      + .config/qalculate/qalc.cfg
      + .config/rustdesk/**
      + .config/xdotool/**
      + .config/xsettingsd/**
      + .config/neofetch/config.conf
      + .config/qBittorrent/*.conf
      + .config/mimeapps.list

      # ============================================
      # INCLUDE: Outside .config
      # ============================================
      + .ideavimrc
      + .local/share/konsole/**

      # ============================================
      # Catch-all
      # ============================================
      - **
    '';

    ".config/rclone/filter/firefox profile.txt".text = ''
      # ============================================
      # Firefox / Zen browser profile filter
      # Sync user prefs, bookmarks, logins, sessions
      # ============================================

      # === EXCLUDE: Runtime / lock files ===
      - .parentlock
      - lock
      - *.tmp
      - *.sqlite-shm
      - times.json

      # === EXCLUDE: Cache & telemetry ===
      - crashes/**
      - minidumps/**
      - datareporting/**
      - saved-telemetry-pings/**
      - weave/**
      - storage-sync-v2.sqlite*
      - favicons.sqlite*
      - gmp/**
      - features/**
      - security_state/**
      - chrome_debugger_profile/**
      - AlternateServices.bin
      - SiteSecurityServiceState.bin
      - bounce-tracking-protection.sqlite
      - broadcast-listeners.json
      - domain_to_categories.sqlite*
      - enumerate_devices.txt
      - notificationstore.json
      - new-tab.html
      - serviceworker.txt
      - sessionCheckpoints.json
      - ExperimentStoreData.json
      - shield-preference-experiments.json

      # ============================================
      # INCLUDE: Preferences & config
      # ============================================
      + prefs.js
      + user.js
      + compatibility.ini
      + pkcs11.txt
      + handlers.json
      + downloads.json
      + search.json.mozlz4
      + cert_override.txt

      # ============================================
      # INCLUDE: Extensions & add-ons
      # ============================================
      + extensions/**
      + extension-store/**
      + extension-store-menus/**
      + extension-store-userscripts/**
      + extension-dnr/**
      + addonStartup.json.lz4
      + extensions.json
      + extension-settings.json
      + extension-preferences.json
      + browser-extension-data/**

      # ============================================
      # INCLUDE: Bookmarks & history
      # ============================================
      + places.sqlite
      + places.sqlite-wal
      + bookmarkbackups/**
      + content-prefs.sqlite

      # ============================================
      # INCLUDE: Logins & security
      # ============================================
      + key4.db
      + cert9.db
      + logins.db
      + permissions.sqlite
      + protections.sqlite
      + containers.json

      # ============================================
      # INCLUDE: Cookies & storage
      # ============================================
      + cookies.sqlite
      + cookies.sqlite-wal
      + cookies.sqlite.bak
      + storage/**
      + storage.sqlite
      + webappsstore.sqlite
      + formhistory.sqlite

      # ============================================
      # INCLUDE: Session
      # ============================================
      + sessionstore-backups/**
      + xulstore.json

      # ============================================
      # INCLUDE: Theme & customization
      # ============================================
      + chrome/**
      + zen-themes.json

      # ============================================
      # INCLUDE: Zen-specific
      # ============================================
      + zen-keyboard-shortcuts.json
      + zen-live-folders.jsonlz4
      + zen-sessions.jsonlz4
      + chat-store.sqlite
      + chat-store.sqlite-wal

      # ============================================
      # Catch-all
      # ============================================
      - **
    '';
  };
}
