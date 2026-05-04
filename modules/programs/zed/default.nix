{
  pkgs,
  spicePkgs,
  ...
}:
let
  wrapped = import ../_nixgl-wrappers.nix { inherit pkgs; };
in
{
  programs.zed-editor = {
    enable = true;

    userSettings = import ./_settings.nix;
    userKeymaps = import ./_config.nix;

    package = wrapped.mkWrappedBinary {
      name = "zeditor";
      binaryName = "zeditor";
      package = pkgs.zed-editor;
    };
  };
}
