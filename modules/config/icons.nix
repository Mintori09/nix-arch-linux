{ pkgs, ... }:

let
  mac-tahoe-src = pkgs.fetchFromGitHub {
    owner = "vinceliuice";
    repo = "MacTahoe-icon-theme";
    rev = "dbd54086525a5421541e59be4b6543a8c7be8f81";
    hash = "sha256-eqR+XxQpUKD1sqFUncSgMCsxdFu1uumsDVGzT7Gn7eU=";
  };

  mac-tahoe-base = pkgs.stdenv.mkDerivation {
    name = "MacTahoe-icons-rebuild";
    src = mac-tahoe-src;
    nativeBuildInputs = [ pkgs.gtk3 ];
    installPhase = ''
      mkdir -p $out/share/icons
      bash install.sh -d $out/share/icons
    '';
  };

  mac-tahoe-icons = pkgs.runCommand "MacTahoe-icons-rebuild" { } ''
    mkdir -p $out/share/icons
    ln -s ${mac-tahoe-base}/share/icons/MacTahoe-icons-rebuild $out/share/icons/MacTahoe
  '';
in
{
  xdg.dataFile."icons/MacTahoe".source = "${mac-tahoe-icons}/share/icons/MacTahoe";
}
