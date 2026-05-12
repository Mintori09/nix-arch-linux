{
  config,
  pkgs,
  ...
}:

let
  youtubeDir = "${config.home.homeDirectory}/Desktop/Youtube";
in
{
  home.packages = with pkgs; [
    aria2
    ffmpeg
    yt-dlp
  ];

  xdg.configFile."yt-dlp/config" = {
    force = true;

    text = ''
      # Output settings
      # yt-dlp tự tạo folder nếu chưa có
      -o "${youtubeDir}/%(upload_date)s.%(title).100s.%(ext)s"

      # Video quality
      # bv+ba: best video + best audio
      # /b: fallback sang best single file nếu không có stream tách riêng
      --format "bv+ba/b"

      # Networking
      --force-ipv4

      # Filename safety
      --trim-filenames 100

      # Không dừng cả playlist nếu một video lỗi
      --ignore-errors
      --no-abort-on-error

      # Metadata / chapters / thumbnail
      --embed-metadata
      --embed-thumbnail
      --embed-chapters

      # Subtitles
      # Có sub thì tải/nhúng, không có thì bỏ qua
      --write-subs
      --write-auto-subs
      --sub-langs "en.*"
      --sub-format "best"
      --embed-subs

      # Dùng mkv để embed subtitles ổn định hơn mp4
      --merge-output-format mkv

      # Playlist
      --yes-playlist

      # SponsorBlock
      --sponsorblock-remove sponsor,selfpromo,interaction

      # Browser cookies
      --cookies-from-browser firefox

      # Aria2 disabled by default because it can be slower for YouTube
      # --downloader aria2c
      # --downloader-args aria2c:'--continue --min-split-size=20M --max-connection-per-server=2 --split=2'
    '';
  };

  home.shellAliases = {
    # Tải nhạc mp3
    download-music = "yt-dlp -x --audio-format mp3 --audio-quality 0 -o '${youtubeDir}/%(title).100s.%(ext)s'";

    # Tải video bình thường bằng yt-dlp trực tiếp
    ytdlp = "yt-dlp";

    # Chỉ dùng aria2 khi muốn test thủ công
    ytdlp-aria = "yt-dlp --downloader aria2c --downloader-args aria2c:'--continue --min-split-size=20M --max-connection-per-server=2 --split=2'";
  };
}
