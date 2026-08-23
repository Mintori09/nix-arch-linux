{ ... }:
{
  xdg.mimeApps = {
    enable = true;
    defaultApplications = {
      # Web Browser
      "text/html" = [ "firefox.desktop" ];
      "x-scheme-handler/http" = [ "firefox.desktop" ];
      "x-scheme-handler/https" = [ "firefox.desktop" ];
      "x-scheme-handler/about" = [ "firefox.desktop" ];
      "x-scheme-handler/unknown" = [ "firefox.desktop" ];

      # Email Client
      "x-scheme-handler/mailto" = [ "thunderbird.desktop" ];
      "message/rfc822" = [ "thunderbird.desktop" ];
      "x-scheme-handler/mid" = [ "thunderbird.desktop" ];

      # PDF Viewer
      "application/pdf" = [
        "org.pwmt.zathura.desktop"
        "zathura.desktop"
      ];
      "application/x-pdf" = [
        "org.pwmt.zathura.desktop"
        "zathura.desktop"
      ];

      # Image Viewer (Gwenview)
      "image/jpeg" = [ "org.kde.gwenview.desktop" ];
      "image/png" = [ "org.kde.gwenview.desktop" ];
      "image/gif" = [ "org.kde.gwenview.desktop" ];
      "image/webp" = [ "org.kde.gwenview.desktop" ];
      "image/bmp" = [ "org.kde.gwenview.desktop" ];
      "image/svg+xml" = [ "org.kde.gwenview.desktop" ];
      "image/tiff" = [ "org.kde.gwenview.desktop" ];
      "image/avif" = [ "org.kde.gwenview.desktop" ];
      "image/heic" = [ "org.kde.gwenview.desktop" ];
      "image/heif" = [ "org.kde.gwenview.desktop" ];

      # Video Player (MPV)
      "video/mp4" = [ "mpv.desktop" ];
      "video/mkv" = [ "mpv.desktop" ];
      "video/x-matroska" = [ "mpv.desktop" ];
      "video/webm" = [ "mpv.desktop" ];
      "video/avi" = [ "mpv.desktop" ];
      "video/x-msvideo" = [ "mpv.desktop" ];
      "video/quicktime" = [ "mpv.desktop" ];
      "video/x-flv" = [ "mpv.desktop" ];
      "video/x-ms-wmv" = [ "mpv.desktop" ];
      "video/ogg" = [ "mpv.desktop" ];
      "video/3gpp" = [ "mpv.desktop" ];

      # Music / Audio Player (MPV)
      "audio/mpeg" = [ "mpv.desktop" ];
      "audio/mp3" = [ "mpv.desktop" ];
      "audio/flac" = [ "mpv.desktop" ];
      "audio/x-flac" = [ "mpv.desktop" ];
      "audio/wav" = [ "mpv.desktop" ];
      "audio/x-wav" = [ "mpv.desktop" ];
      "audio/ogg" = [ "mpv.desktop" ];
      "audio/aac" = [ "mpv.desktop" ];
      "audio/m4a" = [ "mpv.desktop" ];
      "audio/mp4" = [ "mpv.desktop" ];
      "audio/opus" = [ "mpv.desktop" ];

      # Text Editor (Helix)
      "text/plain" = [ "Helix.desktop" ];
      "text/markdown" = [ "Helix.desktop" ];
      "text/x-makefile" = [ "Helix.desktop" ];
      "text/x-c" = [ "Helix.desktop" ];
      "text/x-c++" = [ "Helix.desktop" ];
      "text/x-csrc" = [ "Helix.desktop" ];
      "text/x-chdr" = [ "Helix.desktop" ];
      "text/x-python" = [ "Helix.desktop" ];
      "text/x-shellscript" = [ "Helix.desktop" ];
      "application/json" = [ "Helix.desktop" ];
      "application/toml" = [ "Helix.desktop" ];
      "application/yaml" = [ "Helix.desktop" ];
      "application/xml" = [ "Helix.desktop" ];
      "application/x-yaml" = [ "Helix.desktop" ];

      # Terminal Emulator (Kitty)
      "x-scheme-handler/terminal" = [ "kitty.desktop" ];

      # Archive Manager (Ark)
      "application/zip" = [ "org.kde.ark.desktop" ];
      "application/x-tar" = [ "org.kde.ark.desktop" ];
      "application/x-compressed-tar" = [ "org.kde.ark.desktop" ];
      "application/x-bzip" = [ "org.kde.ark.desktop" ];
      "application/x-bzip-compressed-tar" = [ "org.kde.ark.desktop" ];
      "application/x-xz" = [ "org.kde.ark.desktop" ];
      "application/x-xz-compressed-tar" = [ "org.kde.ark.desktop" ];
      "application/x-7z-compressed" = [ "org.kde.ark.desktop" ];
      "application/x-rar" = [ "org.kde.ark.desktop" ];
      "application/x-rar-compressed" = [ "org.kde.ark.desktop" ];
      "application/vnd.rar" = [ "org.kde.ark.desktop" ];
      "application/gzip" = [ "org.kde.ark.desktop" ];
      "application/x-gzip" = [ "org.kde.ark.desktop" ];
      "application/zstd" = [ "org.kde.ark.desktop" ];
      "application/x-zstd-compressed-tar" = [ "org.kde.ark.desktop" ];
    };
  };

  xdg.configFile."mimeapps.list".force = true;
}
