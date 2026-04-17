{
  config,
  pkgs,
  ...
}:
let
  configFile = "yt-dlp/config";
in
{
  home.packages = with pkgs; [
    yt-dlp
    aria2
  ];
  xdg.configFile."${configFile}" = {
    force = true;
    text = ''
      -o ${config.home.homeDirectory}/Desktop/Youtube/%(upload_date)s.%(title).100s.%(ext)s
      --trim-filenames 100
      --format "bv+ba/b"
      --force-ipv4
      --no-check-certificates
      --embed-metadata
      --embed-thumbnail
      --embed-chapters
      --write-auto-sub
      --write-sub
      --sub-langs en,vi
      --embed-subs
      --yes-playlist
      --sponsorblock-remove sponsor,selfpromo,interaction
      --downloader aria2c
      --downloader-args aria2c:'--continue --min-split-size=5M --max-connection-per-server=4'
      --cookies-from-browser zen-browser
    '';
  };

  home.shellAliases = {
    download-music = "yt-dlp -x --audio-format mp3 -o '${config.home.homeDirectory}/Desktop/Youtube/%(title)s.%(ext)s'";
  };
}
