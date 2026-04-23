{
  pkgs,
  ...
}:
let
  wrapped = import ./_nixgl-wrappers.nix { inherit pkgs; };
in
{
  programs.alacritty = {
    enable = true;
    package = wrapped.mkWrappedBinary {
      name = "alacritty";
      package = pkgs.alacritty;
    };
  };
}
