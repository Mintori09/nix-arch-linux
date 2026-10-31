{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
  inherit (sources.neovide) pname version src;

  appimageContents = pkgs.appimageTools.extract { inherit pname version src; };
in

pkgs.appimageTools.wrapType2 {
  inherit pname version src;

  extraPkgs = pkgs: [
    pkgs.dejavu_fonts
  ];

  extraInstallCommands = ''
    install -m 444 -D ${appimageContents}/neovide.desktop $out/share/applications/neovide.desktop
    substituteInPlace $out/share/applications/neovide.desktop \
      --replace-fail 'Exec=neovide %F' "Exec=$out/bin/${pname} %F"
    install -m 444 -D ${appimageContents}/neovide.svg $out/share/icons/hicolor/scalable/apps/neovide.svg
  '';

  meta = with pkgs.lib; {
    description = "No Nonsense Neovim Client in Rust";
    homepage = "https://github.com/neovide/neovide";
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "neovide";
  };
}
