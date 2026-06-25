{
  config,
  lib,
  pkgs,
  inputs,
  ...
}:
{
  home.activation.kwinSwitchDesktop = config.lib.dag.entryAfter [ "writeBoundary" ] ''
    if [ -x "$(command -v kpackagetool6)" ]; then
      kpackagetool6 --type KWin/Script --remove luisbocanegra.switchlastdesktop 2>/dev/null || true
      kpackagetool6 --type KWin/Script --install "${inputs.kwin-last-desktop}/package"
    fi
  '';
}
