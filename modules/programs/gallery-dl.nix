{
  config,
  pkgs,
  ...
}:

let
  galleryDir = "${config.home.homeDirectory}/Pictures/gallery-dl";
  galleryDlCompletion = pkgs.writeTextFile {
    name = "gallery-dl-zsh-completion";
    destination = "/share/zsh/site-functions/_gallery-dl";
    text = builtins.readFile ../scripts/completions/_gallery-dl;
  };
in
{
  home.packages = [
    galleryDlCompletion
  ];

  programs.gallery-dl = {
    enable = true;
    settings = {
      extractor = {
        "base-directory" = galleryDir;
        "archive" = "${galleryDir}/archive.sqlite3";
        "archive-pragma" = [
          "journal_mode=WAL"
          "synchronous=NORMAL"
        ];
        "retries" = 4;
        "timeout" = 30.0;

        # Pixiv settings
        pixiv = {
          ugoira = true;
          postprocessors = [ "ugoira-mp4" ];
        };

        # Twitter / X settings
        twitter = {
          text-posts = false;
          videos = true;
        };

        # Danbooru / booru settings
        danbooru = {
          ugoira = true;
          postprocessors = [ "ugoira-webm" ];
        };
      };

      downloader = {
        part = true;
        retries = 4;
        timeout = 30.0;
        mtime = true;
        progress = 2.0;

        # Use yt-dlp for video extraction where supported
        ytdl = {
          module = "yt_dlp";
          forward-cookies = true;
        };
      };

      output = {
        ansi = true;
        shorten = "eaw";
        progress = true;
        log = {
          level = "info";
        };
      };

      postprocessor = {
        ugoira-webm = {
          name = "ugoira";
          extension = "webm";
          ffmpeg-args = [
            "-c:v"
            "libvpx-vp9"
            "-an"
            "-b:v"
            "0"
            "-crf"
            "30"
          ];
          ffmpeg-twopass = false;
        };
        ugoira-mp4 = {
          name = "ugoira";
          extension = "mp4";
          ffmpeg-args = [
            "-c:v"
            "libx264"
            "-an"
            "-b:v"
            "4M"
            "-preset"
            "fast"
          ];
          libx264-prevent-odd = true;
        };
        cbz = {
          name = "zip";
          extension = "cbz";
        };
      };
    };
  };

  home.shellAliases = {
    gdl = "gallery-dl";
    gdl-ff = "gallery-dl --cookies-from-browser firefox";
    gdl-info = "gallery-dl -j";
    gdl-sim = "gallery-dl -s -v";
  };
}
