{ pkgs, ... }:

let
  sources = pkgs.callPackage ./_sources/generated.nix { };
in
pkgs.python3Packages.gdown.overridePythonAttrs (old: {
  inherit (sources.gdown) pname version src;

  dependencies = (old.dependencies or [ ]) ++ [
    pkgs.python3Packages.urllib3
  ];

  meta = (old.meta or { }) // {
    description = "CLI tool for downloading large files from Google Drive";
    homepage = "https://github.com/wkentaro/gdown";
    changelog = "https://github.com/wkentaro/gdown/releases/tag/v${sources.gdown.version}";
    mainProgram = "gdown";
  };
})
