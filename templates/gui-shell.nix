# GUI-friendly shell.nix for non-NixOS systems
# Hybrid: Nix tools + System GUI libraries
# Usage: dw init qt --gui
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "gui-dev";

  # Only tools - NOT GUI libraries (use system ones)
  buildInputs = with pkgs; [
    # Build tools
    cmake
    pkg-config
    gcc
    gnumake

    # Language tools (provided by Nix)
    nodejs
    python3
    go
    rustc
    cargo
    bun

    # Optional: non-GUI Nix libraries only
  ];

  # Clear LD_LIBRARY_PATH to use system libraries
  shellHook = ''
    echo "🛠️  Nix tools + system GUI libraries"
    echo "💡 LD_LIBRARY_PATH cleared for system GUI compatibility"
    
    # System GUI variables - DO NOT set LD_LIBRARY_PATH to Nix paths
    export GDK_BACKEND=x11
    export QT_QPA_PLATFORM=xcb
    export LD_LIBRARY_PATH=""
  '';
}