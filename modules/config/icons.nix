{ pkgs, ... }:

let
  mkos-big-sur = pkgs.fetchFromGitHub {
    owner = "zayronxio";
    repo = "Mkos-Big-Sur";
    rev = "29772d17999a5c771873420f3379888d66d2e3c1";
    hash = "sha256-8qAADWjAvhIlq1uxGIfvfguc90FivXKPToKW1dxPpDs=";
  };

  mac-tahoe-src = pkgs.fetchFromGitHub {
    owner = "vinceliuice";
    repo = "MacTahoe-icon-theme";
    rev = "dbd54086525a5421541e59be4b6543a8c7be8f81";
    hash = "sha256-eqR+XxQpUKD1sqFUncSgMCsxdFu1uumsDVGzT7Gn7eU=";
  };

  mac-tahoe-base = pkgs.stdenv.mkDerivation {
    name = "MacTahoe-icons";
    src = mac-tahoe-src;
    nativeBuildInputs = [ pkgs.gtk3 ];
    installPhase = ''
      mkdir -p $out/share/icons
      bash install.sh -d $out/share/icons
    '';
  };

  mac-tahoe-icons = pkgs.runCommand "MacTahoe-icons" { } ''
    mkdir -p $out/share/icons
    ln -s ${mac-tahoe-base}/share/icons/MacTahoe-icons $out/share/icons/MacTahoe
    ln -s ${mac-tahoe-base}/share/icons/MacTahoe-icons-dark $out/share/icons/MacTahoe-dark
    ln -s ${mac-tahoe-base}/share/icons/MacTahoe-icons-light $out/share/icons/MacTahoe-light
  '';
in
{
  xdg.dataFile."icons/Mkos-Big-Sur".source = mkos-big-sur;
  xdg.dataFile."icons/MacTahoe".source = "${mac-tahoe-icons}/share/icons/MacTahoe";
  xdg.dataFile."icons/MacTahoe-light".source = "${mac-tahoe-icons}/share/icons/MacTahoe-light";
  xdg.dataFile."icons/MacTahoe-dark".source = "${mac-tahoe-icons}/share/icons/MacTahoe-dark";
}
