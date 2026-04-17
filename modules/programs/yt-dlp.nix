{
  config,
  pkgs,
  ...
}:
let
  configFile = "yt-dlp/config";
in
{
  users.users.linuxmobile.packages = with pkgs; [
    yt-dlp
    aria2
  ];
  xdg.configFile."${configFile}".text = ''
    -o ${config.home.homeDirectory}/Music/%(uploader)s/%(title)s.%(ext)s
    --embed-thumbnail
    --embed-metadata
    -f bestaudio/best
    --audio-format opus
    --audio-quality 0
    --continue
    --no-overwrites
    --restrict-filenames
    --sponsorblock-remove sponsor,selfpromo,interaction
    --downloader aria2c
    --downloader-args aria2c:'--continue --min-split-size=5M --max-connection-per-server=4'
  '';
}
