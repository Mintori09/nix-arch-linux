{ pkgs }:
let
  wrapped = import ../_nixgl-wrappers.nix { inherit pkgs; };
in
{
  obsidian = wrapped.mkWrappedBinary {
    name = "obsidian";
    package = pkgs.obsidian;
  };

  vicinae = wrapped.mkWrappedBinary {
    name = "vicinae";
    package = pkgs.vicinae;
  };

  gimp = wrapped.mkWrappedBinary {
    name = "gimp";
    package = pkgs.gimp;
  };

  foliate = wrapped.mkWrappedBinary {
    name = "foliate";
    package = pkgs.foliate;
  };

  drawio = wrapped.mkWrappedBinary {
    name = "drawio";
    package = pkgs.drawio;
  };

  localsend = wrapped.mkWrappedBinary {
    name = "localsend";
    binaryName = "localsend_app";
    package = pkgs.localsend;
  };
}
