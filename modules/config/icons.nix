{ pkgs, ... }:

let
  mkos-big-sur = pkgs.fetchFromGitHub {
    owner = "zayronxio";
    repo = "Mkos-Big-Sur";
    rev = "29772d17999a5c771873420f3379888d66d2e3c1";
    hash = "sha256-8qAADWjAvhIlq1uxGIfvfguc90FivXKPToKW1dxPpDs=";
  };
in
{
  xdg.dataFile."icons/Mkos-Big-Sur".source = mkos-big-sur;
}
