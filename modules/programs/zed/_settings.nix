{
  agent_servers = {
    opencode = {
      type = "registry";
    };
    claude-acp = {
      type = "registry";
    };
  };

  git_panel = {
    tree_view = false;
    dock = "left";
  };

  tab_bar = {
    show = true;
  };

  vim_mode = true;
  icon_theme = "JetBrains New UI Icons (Dark)";
  theme = "Aura Soft Dark";

  buffer_font_weight = 500;
  buffer_font_size = 14;
  relative_line_numbers = "enabled";

  theme_overrides = {
    "Aura Dark" = {
      "border.variant" = "#15141C";
      border = "#15141C";
      "title_bar.background" = "#15141C";
      "panel.background" = "#15141C";
      "panel.focused_border" = "#4E466E";

      players = [
        {
          cursor = "#BD9DFF";
        }
      ];

      syntax = {
        comment = {
          font_style = "italic";
        };
        "comment.doc" = {
          font_style = "italic";
        };
      };
    };
  };

  title_bar = {
    # "show_onboarding_banner" = false;
    # "show_project_items" = false;
    # "show_branch_name" = false;
    # "show_user_menu" = false;
  };

  project_panel = {
    dock = "left";
    default_width = 250;
    hide_root = false;
    auto_fold_dirs = false;
    starts_open = false;
    git_status = true;
    sticky_scroll = false;
  };
}
