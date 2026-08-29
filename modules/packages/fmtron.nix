{ pkgs, src, ... }:

pkgs.rustPlatform.buildRustPackage {
  pname = "fmtron";
  version = "0.6.0";
  inherit src;

  cargoLock = {
    lockFile = "${src}/Cargo.lock";
  };

  meta = with pkgs.lib; {
    description = "A simple tool for autoformatting RON files";
    homepage = "https://github.com/yusufraji/fmtron";
    license = licenses.mit;
    platforms = [ "x86_64-linux" ];
    mainProgram = "fmtron";
  };
}
