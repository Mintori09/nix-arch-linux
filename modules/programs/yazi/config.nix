{ ... }: {
  programs.yazi.settings = {
    manager = {
      ratio = [
        1
        4
        3
      ];
      sort_by = "alphabetical";
      sort_sensitive = false;
      sort_reverse = false;
      sort_dir_first = true;
      linemode = "none";
      show_hidden = true;
      show_symlink = true;
      mouse_events = [
        "click"
        "scroll"
        "touch"
        "move"
        "drag"
      ];
    };

    preview = {
      image_filter = "lanczos3";
      image_quality = 90;
      tab_size = 1;
      max_width = 600;
      max_height = 900;
      cache_dir = "";
    };

    opener = {
      edit = [
        {
          run = ''nvim "$@"'';
          block = true;
          desc = "Edit with Neovim";
        }
      ];
      play = [
        {
          run = ''mpv "$@"'';
          orphan = true;
          desc = "Play with MPV";
        }
      ];
    };

    plugin = {
      prepend_preloaders = [
        {
          mime = "application/openxmlformats-officedocument.*";
          run = "office";
        }
        {
          mime = "application/oasis.opendocument.*";
          run = "office";
        }
        {
          mime = "application/ms-*";
          run = "office";
        }
        {
          mime = "application/msword";
          run = "office";
        }
        {
          name = "*.docx";
          run = "office";
        }
      ];

      prepend_previewers = [
        {
          mime = "application/openxmlformats-officedocument.*";
          run = "office";
        }
        {
          mime = "application/oasis.opendocument.*";
          run = "office";
        }
        {
          mime = "application/ms-*";
          run = "office";
        }
        {
          mime = "application/msword";
          run = "office";
        }
        {
          name = "*.docx";
          run = "office";
        }
      ];
    };

    tasks = {
      micro_workers = 5;
      macro_workers = 10;
      bizarre_retry = 5;
    };
  };
}
