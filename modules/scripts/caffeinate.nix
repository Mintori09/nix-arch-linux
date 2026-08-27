{ pkgs, ... }:

let
  caffeinatePkg = pkgs.writeShellScriptBin "caffeinate" ''
    GET_INHIBITORS() {
      ${pkgs.systemd}/bin/busctl call org.freedesktop.login1 /org/freedesktop/login1 org.freedesktop.login1.Manager ListInhibitors --json=short 2>/dev/null | ${pkgs.jq}/bin/jq -c '.data[0] // []'
    }

    INHIBITOR_ID="HM-Caffeinate"

    if [ "$1" = "toggle" ] || [ -z "$1" ]; then
      if (GET_INHIBITORS | ${pkgs.jq}/bin/jq -e "any(.[]; .[1] == \"$INHIBITOR_ID\")" > /dev/null 2>&1); then
        ${pkgs.procps}/bin/pkill -f "systemd-inhibit.*--who=$INHIBITOR_ID"
        ${pkgs.libnotify}/bin/notify-send -u low -t 3000 -a "Caffeinate" "☕ Caffeinate" "Deactivated: System can now sleep"
      else
        ${pkgs.systemd}/bin/systemd-inhibit --who="$INHIBITOR_ID" --why="User requested caffeinate" --what=idle:sleep:handle-lid-switch ${pkgs.coreutils}/bin/sleep infinity &
        ${pkgs.libnotify}/bin/notify-send -u low -t 3000 -a "Caffeinate" "☕ Caffeinate" "Activated: System sleep is inhibited"
      fi
    elif [ "$1" = "status" ]; then
      INHIBITORS_JSON=$(GET_INHIBITORS)
      IS_CAFFEINATED=$(echo "$INHIBITORS_JSON" | ${pkgs.jq}/bin/jq -r "any(.[]; .[1] == \"$INHIBITOR_ID\")")

      TOOLTIP=$(echo "$INHIBITORS_JSON" | ${pkgs.jq}/bin/jq -r '
        map(select(.[3] == "block")) |
        if length > 0 then
          "<b>Active Inhibitors:</b>\n" + ([.[] | "• <b>\(.[1])</b> (\(.[0])): \(.[2])"] | join("\n"))
        else
          "No active inhibitors"
        end
      ')

      ICON=""
      CLASS="inactive"
      if [ "$IS_CAFFEINATED" = "true" ]; then
        ICON="󰅶"
        CLASS="active"
      fi

      ${pkgs.jq}/bin/jq -nc \
        --arg text "$ICON" \
        --arg tooltip "$TOOLTIP" \
        --arg class "$CLASS" \
        '{"text": $text, "tooltip": $tooltip, "class": $class}'
    fi
  '';
in
{
  home.packages = [ caffeinatePkg ];

  xdg.desktopEntries.caffeinate = {
    name = "Toggle Caffeinate";
    genericName = "Prevent system sleep";
    comment = "Inhibit system idle, sleep, and lid close actions";
    icon = "caffeine";
    exec = "${caffeinatePkg}/bin/caffeinate toggle";
    terminal = false;
    type = "Application";
    categories = [
      "Utility"
      "Settings"
    ];
  };
}
