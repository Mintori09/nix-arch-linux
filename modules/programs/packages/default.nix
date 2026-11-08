{ ... }: {
  imports = [
    ./_desktop-db.nix
    ./spicetify.nix
    ./vicinae.nix
    ./kcolorchooser.nix
    ./neovide.nix
    ./obsidian.nix
    ./gimp.nix
    ./drawio.nix
    ./localsend.nix
    ./systemctl-tui.nix
    # ./sioyek.nix
    ./sheprd.nix
    ./zathura.nix
    ./packettracer.nix
  ];
}
