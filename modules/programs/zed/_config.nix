[
  {
    context = "VimControl && !menu && vim_mode == normal || EmptyPane";
    bindings = {
      "space space" = "file_finder::Toggle";
      "space f f" = "pane::DeploySearch";
      "space b d" = "pane::CloseActiveItem";
      "space e" = "vim::ToggleProjectPanelFocus";
    };
  }
  {
    context = "ProjectPanel && not_editing";
    bindings = {
      "space e" = "vim::ToggleProjectPanelFocus";
      ":" = "command_palette::Toggle";
      "a" = "project_panel::NewFile";
      "/" = "project_panel::NewSearchInDirectory";
      "shift-a" = "project_panel::NewDirectory";
      "d" = "project_panel::Delete";
      "enter" = "project_panel::OpenPermanent";
      "escape" = "project_panel::ToggleFocus";
      "h" = "project_panel::CollapseSelectedEntry";
      "g l" = "menu::SelectNext";
      "g L" = "menu::SelectPrevious";
      "l" = "project_panel::ExpandSelectedEntry";
      "shift-d" = "project_panel::Delete";
      "shift-r" = "project_panel::Rename";
      "t" = "project_panel::OpenPermanent";
      "v" = "project_panel::OpenPermanent";
      "p" = "project_panel::Open";
      "x" = "project_panel::RevealInFileManager";
      "o" = "project_panel::OpenPermanent";
      "O" = "workspace::OpenWithSystem";
      "] c" = "project_panel::SelectNextGitEntry";
      "[ c" = "project_panel::SelectPrevGitEntry";
      "] d" = "project_panel::SelectNextDiagnostic";
      "[ d" = "project_panel::SelectPrevDiagnostic";
      "}" = "project_panel::SelectNextDirectory";
      "{" = "project_panel::SelectPrevDirectory";
      "shift-g" = "menu::SelectLast";
      "g g" = "menu::SelectFirst";
      "-" = "project_panel::SelectParent";
      "ctrl-6" = "pane::AlternateFile";
    };
  }
  {
    context = "";
    bindings = {
      "ctrl-l" = "workspace::ActivatePaneRight";
      "ctrl-h" = "workspace::ActivatePaneLeft";
      "ctrl-j" = "workspace::ActivatePaneDown";
      "ctrl-k" = "workspace::ActivatePaneUp";
      "ctrl-o" = "file_finder::Toggle";
      "ctrl-/" = "terminal_panel::Toggle";
      "ctrl-w v" = "pane::SplitRight";
      "ctrl-w s" = "pane::SplitDown";
    };
  }
  {
    context = "Editor && vim_mode == normal";
    bindings = {
      "shift-h" = "pane::ActivatePreviousItem";
      "shift-l" = "pane::ActivateNextItem";
      "g d" = "editor::GoToDefinition";
      "space c f" = "editor::Format";
      "space f b" = "tab_switcher::Toggle";
      "space o p" = [
        "vim::StartOfDocument"
        "vim::EndOfDocument"
      ];
    };
  }
  {
    context = "Editor && vim_mode == visual";
    bindings = {
      "g s a" = "vim::PushAddSurrounds";
      "shift-h" = "pane::ActivatePreviousItem";
      "shift-l" = "pane::ActivateNextItem";
    };
  }
  {
    context = "!menu && vim_mode==insert";
    bindings = {
      "ctrl-v" = "vim::Paste";
    };
  }
  {
    context = "Editor && VimControl && !VimWaiting && !menu";
    bindings = {
      "g l" = "vim::SelectNext";
      "g L" = "vim::SelectPrevious";
      "g a" = "editor::SelectAllMatches";
      "g shift-a" = "editor::FindAllReferences";
      "space p e" = "diagnostics::Deploy";
    };
  }
]
