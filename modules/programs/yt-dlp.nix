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
    aria2
    ffmpeg
  ];

  xdg.configFile."${configFile}" = {
    force = true;
    text = ''
      # Output settings (yt-dlp creates folders in the path automatically)
      -o "${config.home.homeDirectory}/Desktop/Youtube/%(upload_date)s.%(title).100s.%(ext)s"

      # Video Quality and Networking
      --format "bv+ba/b"
      --force-ipv4
      --trim-filenames 100

      # Post-processing / Embedding
      --embed-metadata
      --embed-thumbnail
      --embed-chapters
      --write-auto-sub
      --write-sub
      --sub-langs en,vi
      --embed-subs

      # Plugins and Tools
      --yes-playlist
      --sponsorblock-remove sponsor,selfpromo,interaction
      --downloader aria2c
      --downloader-args aria2c:'--continue --min-split-size=5M --max-connection-per-server=4'

      # Browser Integration
      --cookies-from-browser firefox
    '';
  };

  home.shellAliases = {
    download-music = "yt-dlp -x --audio-format mp3 --audio-quality 0 -o '${config.home.homeDirectory}/Desktop/Youtube/%(title)s.%(ext)s'";
  };
}
