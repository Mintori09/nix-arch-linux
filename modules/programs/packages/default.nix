{ ... }: {
  imports = [
    ./_desktop-db.nix
    ./spicetify.nix
    ./vicinae.nix
    ./kcolorchooser.nix
    ./obsidian.nix
    ./gimp.nix
    # ./foliate.nix
    ./drawio.nix
    ./localsend.nix
    ./systemctl-tui.nix
    # ./sioyek.nix
    ./zathura.nix
    ./packettracer.nix
  ];
}
