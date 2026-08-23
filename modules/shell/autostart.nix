{ config, pkgs, ... }:

{
  xdg.configFile."autostart/firefox-kitty-spotify.desktop".text = ''
    [Desktop Entry]
    Type=Application
    Name=Launch Firefox Kitty Spotify
    Exec=${config.home.homeDirectory}/.config/home-manager/scripts/profile/firefox-kitty-spotify.sh
    Terminal=false
    X-KDE-autostart-phase=2
  '';
}
