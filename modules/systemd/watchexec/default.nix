{ pkgs, ... }:

let
  # videoIndexerScript = pkgs.writeShellScript "generate_thumbnails.sh" (
  #   builtins.readFile ./generate_thumbnails.sh
  # );
in
{
  home.packages = [
    pkgs.watchexec
    pkgs.ffmpeg
  ];

  # systemd.user.services.obsidian-video-indexer = {
  #   Unit = {
  #     Description = "Tự động quét video và tạo thumbnail cho Obsidian tại Desktop/Youtube";
  #     After = [ "default.target" ];
  #   };
  #
  #   Service = {
  #     Type = "simple";
  #     WorkingDirectory = "%h/Desktop/Youtube";
  #     ExecStart = "${pkgs.watchexec}/bin/watchexec -e mp4,mkv,avi,mov,flv,wmv --clear -- ${videoIndexerScript}";
  #     Restart = "on-failure";
  #     RestartSec = "5s";
  #   };
  #
  #   Install = {
  #     WantedBy = [ "default.target" ];
  #   };
  # };
}
