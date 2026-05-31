{ pkgs, ... }:

let
  mac-tahoe-src = pkgs.fetchFromGitHub {
    owner = "vinceliuice";
    repo = "MacTahoe-kde";
    rev = "4c0ad8fe730d32c892c84ab0dcf9a104a6fd466d";
    hash = "sha256-6saJ9t1KZeIkCwR6ePKSnJxSsba0XRmck8g8/JDuuBE=";
  };

  mac-tahoe-aurorae = pkgs.runCommand "mactahoe-aurorae" { } ''
    auroraeSrc="${mac-tahoe-src}/aurorae"
    mkdir -p $out

    for themeName in MacTahoe-Light MacTahoe-Dark MacTahoe-Light-1.25x MacTahoe-Dark-1.25x MacTahoe-Light-1.5x MacTahoe-Dark-1.5x; do
      themeDir="$out/$themeName"
      mkdir -p "$themeDir"

      case "$themeName" in
        MacTahoe-Light*) color="Light" ;;
        MacTahoe-Dark*) color="Dark" ;;
      esac

      cp "$auroraeSrc/$themeName"/*.svg "$themeDir/"
      cp "$auroraeSrc/''${color}rc" "$themeDir/$themeName"rc
      cp "$auroraeSrc/icons-''${color}"/*.svg "$themeDir/"
      sed "s/theme_name/$themeName/g" "$auroraeSrc/metadata.desktop" > "$themeDir/metadata.desktop"
      sed "s/theme_name/$themeName/g" "$auroraeSrc/metadata.json" > "$themeDir/metadata.json"
    done
  '';
in
{
  xdg.configFile."Kvantum/MacTahoe" = {
    source = "${mac-tahoe-src}/Kvantum/MacTahoe";
    recursive = true;
    force = true;
  };

  xdg.dataFile."color-schemes/MacTahoeLight.colors".source =
    "${mac-tahoe-src}/color-schemes/MacTahoeLight.colors";
  xdg.dataFile."color-schemes/MacTahoeDark.colors".source =
    "${mac-tahoe-src}/color-schemes/MacTahoeDark.colors";

  xdg.dataFile."plasma/desktoptheme/MacTahoe-Light".source =
    "${mac-tahoe-src}/plasma/desktoptheme/MacTahoe-Light";
  xdg.dataFile."plasma/desktoptheme/MacTahoe-Dark".source =
    "${mac-tahoe-src}/plasma/desktoptheme/MacTahoe-Dark";

  xdg.dataFile."plasma/layout-templates/org.github.desktop.MacOSDock".source =
    "${mac-tahoe-src}/plasma/layout-templates/org.github.desktop.MacOSDock";
  xdg.dataFile."plasma/layout-templates/org.github.desktop.MacOSPanel".source =
    "${mac-tahoe-src}/plasma/layout-templates/org.github.desktop.MacOSPanel";

  xdg.dataFile."plasma/look-and-feel/com.github.vinceliuice.MacTahoe-Light".source =
    "${mac-tahoe-src}/plasma/look-and-feel/com.github.vinceliuice.MacTahoe-Light";
  xdg.dataFile."plasma/look-and-feel/com.github.vinceliuice.MacTahoe-Dark".source =
    "${mac-tahoe-src}/plasma/look-and-feel/com.github.vinceliuice.MacTahoe-Dark";

  xdg.dataFile."wallpapers/MacTahoe".source = "${mac-tahoe-src}/wallpapers/MacTahoe";
  xdg.dataFile."wallpapers/MacTahoe-Light".source = "${mac-tahoe-src}/wallpapers/MacTahoe-Light";
  xdg.dataFile."wallpapers/MacTahoe-Dark".source = "${mac-tahoe-src}/wallpapers/MacTahoe-Dark";

  xdg.dataFile."aurorae/themes/MacTahoe-Light".source = "${mac-tahoe-aurorae}/MacTahoe-Light";
  xdg.dataFile."aurorae/themes/MacTahoe-Dark".source = "${mac-tahoe-aurorae}/MacTahoe-Dark";
  xdg.dataFile."aurorae/themes/MacTahoe-Light-1.25x".source =
    "${mac-tahoe-aurorae}/MacTahoe-Light-1.25x";
  xdg.dataFile."aurorae/themes/MacTahoe-Dark-1.25x".source =
    "${mac-tahoe-aurorae}/MacTahoe-Dark-1.25x";
  xdg.dataFile."aurorae/themes/MacTahoe-Light-1.5x".source =
    "${mac-tahoe-aurorae}/MacTahoe-Light-1.5x";
  xdg.dataFile."aurorae/themes/MacTahoe-Dark-1.5x".source = "${mac-tahoe-aurorae}/MacTahoe-Dark-1.5x";
}
