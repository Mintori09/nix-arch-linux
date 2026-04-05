{ pkgs, ... }:
{

  home.shellAliases = {
    y = "yazi";
  };
  programs.yazi = {
    enable = true;
    enableZshIntegration = true;
    shellWrapperName = "y";

    settings = {
      manager = {
        ratio = [
          1
          4
          3
        ];
        sort_by = "natural";
        sort_sensitive = true;
        sort_reverse = false;
        sort_dir_first = true;
        linemode = "none";
        show_hidden = true;
        show_symlink = true;
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

      tasks = {
        micro_workers = 5;
        macro_workers = 10;
        bizarre_retry = 5;
      };
    };
  };
}
