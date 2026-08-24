{ pkgs, ... }:

let
  cleartextWifiPkg = pkgs.writeShellScriptBin "cleartext-wifi" ''
    export PATH="${pkgs.lib.makeBinPath [
      pkgs.networkmanager
      pkgs.gnugrep
      pkgs.gnused
      pkgs.coreutils
      pkgs.libnotify
      pkgs.wl-clipboard
    ]}:$PATH"

    CON_NAME=$(nmcli -t -f ACTIVE,TYPE,NAME connection show | grep '^yes:802-11-wireless:' | sed 's/^yes:802-11-wireless://')

    if [ -z "$CON_NAME" ]; then
      notify-send -u low -a "Wi-Fi" "📶 Wi-Fi" "Not connected to any Wi-Fi"
      exit 0
    fi

    PASSWORD=$(nmcli -s -g 802-11-wireless-security.psk connection show "$CON_NAME" 2>/dev/null)

    if [ -z "$PASSWORD" ]; then
      notify-send -u low -a "Wi-Fi" "📶 $CON_NAME" "Open network or no password found"
    else
      echo -n "$PASSWORD" | wl-copy
      notify-send -u low -t 15000 -a "Wi-Fi" "📶 $CON_NAME" "🔑 Password: $PASSWORD\n<i>(Copied to clipboard)</i>"
    fi
  '';
in
{
  home.packages = [ cleartextWifiPkg ];

  xdg.desktopEntries.cleartext-wifi = {
    name = "Show Wi-Fi Password";
    genericName = "Copy current Wi-Fi password";
    comment = "Get active Wi-Fi password and copy to clipboard";
    icon = "network-wireless";
    exec = "${cleartextWifiPkg}/bin/cleartext-wifi";
    terminal = false;
    type = "Application";
    categories = [ "Utility" "Network" ];
  };
}
