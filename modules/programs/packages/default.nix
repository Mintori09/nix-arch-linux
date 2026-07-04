{ ... }: {
  imports = [
    ./_desktop-db.nix
    ./spicetify.nix
    ./vicinae.nix
    ./kcolorchooser.nix
    ./obsidian.nix
    ./gimp.nix
    ./foliate.nix
    ./drawio.nix
    ./localsend.nix
    # ./sioyek.nix
    ./zathura.nix
  ];
}
