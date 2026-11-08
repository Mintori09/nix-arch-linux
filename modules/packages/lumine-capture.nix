{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in

pkgs.stdenv.mkDerivation {
  inherit (sources.lumine-capture) pname version src;

  dontUnpack = true;

  nativeBuildInputs = [
    pkgs.autoPatchelfHook
    pkgs.dpkg
  ];

  buildInputs = [
    pkgs.stdenv.cc.cc.lib
    pkgs.openssl
    pkgs.libxkbcommon
    pkgs.pipewire
  ];

  installPhase = ''
    runHook preInstall

    dpkg-deb -x $src .

    mkdir -p $out/bin $out/share
    cp usr/bin/lumine-capture $out/bin/
    chmod +x $out/bin/lumine-capture

    if [ -d usr/share/applications ]; then
      cp -r usr/share/applications $out/share/
      cat << 'EOF' > $out/share/applications/lumine-capture.desktop
[Desktop Entry]
Type=Application
Name=LumineCapture
GenericName=Screenshot Tool
Comment=Screenshot and annotation tool for Wayland with built-in OCR
Exec=lumine-capture
Icon=lumine-capture
Terminal=false
Categories=Graphics;Utility;
Keywords=screenshot;capture;annotate;ocr;
StartupWMClass=lumine-capture
X-KDE-DBUS-Restricted-Interfaces=org.kde.KWin.ScreenShot2
NoDisplay=false
Actions=FullEditor;FullSave;FullClipboard;DragSave;DragOCR;TesseractOCR;ActiveWindow;

[Desktop Action FullEditor]
Name=Full Screen + Editor
Exec=lumine-capture
Icon=lumine-capture

[Desktop Action FullSave]
Name=Full Screen -> Save
Exec=lumine-capture -f -t s
Icon=lumine-capture

[Desktop Action FullClipboard]
Name=Full Screen -> Clipboard
Exec=lumine-capture -f -t c
Icon=lumine-capture

[Desktop Action DragSave]
Name=Drag Region -> Save
Exec=lumine-capture -r
Icon=lumine-capture

[Desktop Action DragOCR]
Name=Drag Region -> OCR Text (Built-in)
Exec=lumine-capture -r ocr -t c
Icon=lumine-capture

[Desktop Action TesseractOCR]
Name=OCR (JP+EN+VI) -> Clipboard & Notify
Exec=lumine-ocr
Icon=lumine-capture

[Desktop Action ActiveWindow]
Name=Active Window (KDE)
Exec=lumine-capture -w
Icon=lumine-capture
EOF
      substituteInPlace $out/share/applications/lumine-capture.desktop \
        --replace 'Exec=lumine-capture' "Exec=$out/bin/lumine-capture"
    fi

    if [ -d usr/share/icons ]; then
      cp -r usr/share/icons $out/share/
    fi

    runHook postInstall
  '';

  meta = with pkgs.lib; {
    description = "Screenshot and annotation tool for Wayland with built-in OCR";
    homepage = "https://github.com/Netflate/LumineCapture";
    license = with licenses; [ asl20 mit ];
    platforms = [ "x86_64-linux" ];
    mainProgram = "lumine-capture";
  };
}
