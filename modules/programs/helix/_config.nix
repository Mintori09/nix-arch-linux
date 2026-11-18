{
  theme = "catppuccin_mocha";
  editor = {
    color-modes = true;
    completion-trigger-len = 1;
    completion-replace = true;
    cursorline = true;
    bufferline = {
      render-mode = "multiple";
    };
    line-number = "relative";
    cursor-shape = {
      insert = "bar";
      normal = "block";
      select = "underline";
    };
    undercurl = true;
    true-color = true;
    soft-wrap.enable = true;
    indent-guides = {
      render = true;
      rainbow-option = "normal";
    };
    inline-diagnostics = {
      cursor-line = "hint";
      other-lines = "error";
      max-diagnostics = 3;
    };
    lsp = {
      display-messages = true;
      display-inlay-hints = true;
    };
    gutters = [
      "diagnostics"
      "line-numbers"
      "spacer"
      "diff"
    ];
    statusline = {
      left = [
        "mode"
        "spacer"
        "version-control"
      ];
      center = [
        "file-modification-indicator"
        "file-name"
        "spinner"
      ];
      right = [
        "diagnostics"
        "selections"
        "position"
        "position-percentage"
        "total-line-numbers"
      ];
      mode = {
        normal = "NORMAL";
        insert = "INSERT";
        select = "SELECT";
      };
    };
    trim-final-newlines = true;
    trim-trailing-whitespace = true;
    whitespace = {
      render = {
        space = "all";
        tab = "all";
        newline = "all";
      };
      characters = {
        space = " ";
        nbsp = "⍽";
        tab = "→";
        newline = "↴";
        tabpad = "-";
      };
    };
    auto-pairs = true;
    clipboard-provider = "wayland";
  };

  keys.insert = {
    C-s = [
      "normal_mode"
      ":w"
    ];
    C-h = "move_char_left";
    C-j = "move_line_down";
    C-k = "move_line_up";
    C-l = "move_char_right";
    C-e = "goto_line_end";
    C-b = "goto_line_start";
    A-j = [
      "normal_mode"
      "extend_to_line_bounds"
      "delete_selection"
      "paste_after"
      "insert_mode"
    ];
    A-k = [
      "normal_mode"
      "extend_to_line_bounds"
      "delete_selection"
      "move_line_up"
      "paste_before"
      "insert_mode"
    ];
  };

  keys.normal = {
    C-s = ":w";
    C-q = ":quit";
    G = [
      "normal_mode"
      "goto_file_end"
    ];

    # Neovim-style core keybindings
    "+" = "increment"; # Increment number under cursor (Neovim '+')
    "-" = "decrement"; # Decrement number under cursor (Neovim '-')
    C-m = "jump_forward"; # Jump forward in jumplist (Neovim '<C-m>')
    x = "delete_selection_noyank"; # Delete character/selection without yanking (Neovim '"_x')
    p = "paste_clipboard_after"; # Paste from clipboard after (Neovim 'p')
    P = "paste_clipboard_before"; # Paste from clipboard before (Neovim 'P')
    V = [
      "extend_to_line_bounds"
      "select_mode"
    ]; # Select current line and enter select mode (Neovim 'V')
    v = "select_mode"; # Enter select mode (Neovim 'v')
    A = "insert_at_line_end"; # Append at end of line (Neovim 'A')
    I = "insert_at_line_start"; # Insert at start of line (Neovim 'I')
    y = [ "yank_main_selection_to_clipboard" ];
    Y = [
      "select_all"
      "yank_main_selection_to_clipboard"
    ]; # Copy all text to clipboard (Neovim map Y -> %y+)
    K = "hover";
    d = {
      d = [
        "extend_to_line_bounds"
        "delete_selection"
      ]; # Delete current line (Neovim 'dd')
    };
    m = {
      c = "keep_primary_selection"; # Clear multi-cursors (Neovim 'mc')
    };
    "\\" = {
      "\\" = "buffer_picker"; # Switch Buffers (Neovim '\\')
    };

    # Buffer & bracket navigation
    H = "goto_previous_buffer"; # Move to left buffer
    L = "goto_next_buffer"; # Move to right buffer
    "[" = {
      b = "goto_previous_buffer";
      d = "goto_prev_diag";
      e = "goto_first_diag";
    };
    "]" = {
      b = "goto_next_buffer";
      d = "goto_next_diag";
      e = "goto_last_diag";
    };

    # Move lines
    A-j = [
      "extend_to_line_bounds"
      "delete_selection"
      "paste_after"
    ];
    A-k = [
      "extend_to_line_bounds"
      "delete_selection"
      "move_line_up"
      "paste_before"
    ];
    A-h = [
      "delete_selection"
      "move_char_left"
      "paste_before"
    ];
    A-l = [
      "delete_selection"
      "move_char_right"
      "paste_after"
    ];

    # Window jumps
    C-h = [ "jump_view_left" ];
    C-j = [ "jump_view_down" ];
    C-k = [ "jump_view_up" ];
    C-l = [ "jump_view_right" ];

    tab = [ "goto_next_buffer" ];
    S-tab = [ "goto_previous_buffer" ];

    # Leader key (<space>) mappings matching Neovim / LazyVim
    space = {
      space = "file_picker"; # <leader><space> -> Find Files
      "/" = "global_search"; # <leader>/ -> Live Grep
      "," = "buffer_picker"; # <leader>, -> Buffers
      "`" = "goto_last_accessed_file"; # <leader>` -> Switch to Other Buffer (e #)
      "-" = "hsplit"; # <leader>- -> Horizontal Split
      "|" = "vsplit"; # <leader>| -> Vertical Split
      d = "delete_selection_noyank"; # <leader>d -> Delete without yanking (Neovim '"_d')
      e = "file_explorer"; # <leader>e -> Explorer (Root Dir)
      E = "file_explorer_in_current_buffer_directory"; # <leader>E -> Explorer (Current Buffer Dir)
      K = "hover"; # <leader>K -> Keywordprg / Hover

      k = {
        k = "hover"; # <leader>kk -> LSP Hover / Show Value
      };

      # Buffer management (<leader>b...)
      b = {
        b = "buffer_picker"; # <leader>bb -> Switch Buffer
        d = ":buffer-close"; # <leader>bd -> Delete Buffer
        o = ":buffer-close-others"; # <leader>bo -> Close Other Buffers
        n = "goto_next_buffer"; # <leader>bn -> Next Buffer
        p = "goto_previous_buffer"; # <leader>bp -> Prev Buffer
      };

      # File picker & utilities (<leader>f...)
      f = {
        f = "file_picker"; # <leader>ff -> Find Files
        b = "buffer_picker"; # <leader>fb -> Buffers
        n = ":new"; # <leader>fn -> New File
      };

      # Window management (<leader>w...)
      w = {
        d = ":quit"; # <leader>wd -> Close Window
        h = "jump_view_left";
        j = "jump_view_down";
        k = "jump_view_up";
        l = "jump_view_right";
        s = "hsplit";
        v = "vsplit";
        q = ":quit";
      };

      # Code / LSP (<leader>c...)
      c = {
        f = ":format"; # <leader>cf -> Format code
        d = "diagnostics_picker"; # <leader>cd -> Diagnostics
        r = "rename_symbol"; # <leader>cr -> Rename
        a = "code_action"; # <leader>ca -> Code Action
        s = "symbol_picker"; # <leader>cs -> Outline / Document Symbols
      };

      # Git (<leader>g...)
      g = {
        g = ":sh lazygit"; # <leader>gg -> Lazygit
        b = ":sh git blame"; # <leader>gb -> Git Blame
      };

      # Open / Clipboard utilities (<leader>o...)
      o = {
        p = [
          "select_all"
          "replace_selections_with_clipboard"
        ]; # <leader>op -> Replace entire file with clipboard
        u = [
          "move_prev_long_word_start"
          "move_next_long_word_end"
          ":pipe-to xargs -r xdg-open"
          "collapse_selection"
        ]; # <leader>ou -> Open URL under cursor
      };

      # Search utilities (<leader>s...)
      s = {
        k = "command_palette"; # <leader>sk -> Search Keymaps / Commands
      };

      # Diagnostics / Quickfix-like (<leader>x...)
      x = {
        d = "diagnostics_picker";
        D = "workspace_diagnostics_picker";
        x = "workspace_diagnostics_picker"; # <leader>xx -> Diagnostics (Trouble)
        X = "diagnostics_picker"; # <leader>xX -> Buffer Diagnostics (Trouble)
      };

      # UI toggles (<leader>u...)
      u = {
        f = ":format";
        w = ":set whitespace.render all";
        W = ":set whitespace.render none";
        d = [
          ":toggle inline-diagnostics.cursor-line 'hint' 'disable'"
          ":toggle inline-diagnostics.other-lines 'error' 'disable'"
        ];
        r = [
          ":redraw"
          "keep_primary_selection"
          "collapse_selection"
        ]; # <leader>ur -> Redraw & Clear selection
      };

      # Quit (<leader>q...)
      q = {
        q = ":quit-all!"; # <leader>qq -> Quit All
      };
    };

    # Picker prefix retained as requested (;r, ;f, etc.)
    ";" = {
      f = "file_picker"; # ;f -> Find Files
      r = "global_search"; # ;r -> Live Grep (Search text)
      s = "symbol_picker"; # ;s -> Document Symbols
      S = "workspace_symbol_picker"; # ;S -> Workspace Symbols
      e = "diagnostics_picker"; # ;e -> Document Diagnostics
      E = "workspace_diagnostics_picker"; # ;E -> Workspace Diagnostics
      g = ":sh lazygit"; # ;g -> Lazygit
      h = "changed_file_picker"; # ;h -> Git Changed Files / Diffs
      k = "command_palette"; # ;k -> Search Keymaps / Commands
      t = "command_palette"; # ;t -> Command Palette / Help
      ";" = "last_picker"; # ;; -> Mở lại picker vừa dùng
    };
  };

  keys.select = {
    G = "extend_to_file_end";
    y = [
      "yank_main_selection_to_clipboard"
      "normal_mode"
    ];
    x = "delete_selection_noyank"; # Delete selection without overwriting clipboard (Neovim '"_x')
    "<" = "unindent";
    ">" = "indent";
    space = {
      d = "delete_selection_noyank"; # <leader>d -> Delete selection without yanking
      o = {
        p = [
          "select_all"
          "replace_selections_with_clipboard"
        ]; # <leader>op -> Replace entire file with clipboard
      };
    };
    A-j = [
      "extend_to_line_bounds"
      "delete_selection"
      "paste_after"
    ];
    A-k = [
      "extend_to_line_bounds"
      "delete_selection"
      "move_line_up"
      "paste_before"
    ];
  };
}
