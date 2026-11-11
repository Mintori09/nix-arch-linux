{ config, pkgs, ... }:

let
  previewScript = pkgs.writeShellScript "copy-file-path-preview" (
    builtins.readFile ./helper/copy-file-path-preview.sh
  );
in
{
  xdg.desktopEntries.preview-file = {
    name = "Preview File";
    genericName = "File Preview";
    comment = "Preview selected file with kglance";
    exec = "${previewScript}";
    terminal = false;
    type = "Application";
    noDisplay = false;

    actions = {
      "preview" = {
        name = "Preview with kglance";
        exec = "${previewScript}";
      };
    };
  };
}
