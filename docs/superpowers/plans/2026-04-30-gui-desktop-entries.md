# GUI Desktop Entries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Home Manager desktop entries for wrapped GUI applications so they appear in the launcher and execute through the existing `nixGL` wrappers.

**Architecture:** Keep the existing `mkWrappedBinary` helper unchanged. Refactor `modules/programs/packages.nix` so each wrapped GUI package is bound in `let`, reused in `home.packages`, and referenced by new `xdg.desktopEntries` definitions with explicit metadata.

**Tech Stack:** Nix, Home Manager, desktop entry generation via `xdg.desktopEntries`

---

## File Structure

- Modify `modules/programs/packages.nix`
  - Define reusable wrapped package variables for each GUI app.
  - Keep existing `programs.*` declarations intact.
  - Reuse wrapped packages in `home.packages`.
  - Add `xdg.desktopEntries` entries for `mpv`, `obsidian`, `hoppscotch`, `nautilus`, `vicinae`, and `gimp`.
- Verify `docs/superpowers/specs/2026-04-30-gui-desktop-entries-design.md`
  - Use as the source of truth for metadata scope and launcher behavior.

### Task 1: Refactor wrapped GUI packages into reusable bindings

**Files:**
- Modify: `modules/programs/packages.nix`
- Test: `modules/programs/packages.nix`

- [ ] **Step 1: Write the failing structure check**

Inspect the file and confirm the wrapped GUI packages under `home.packages` are currently inline expressions, which prevents reusing their store paths in `xdg.desktopEntries`.

Expected missing structure:

```nix
let
  wrapped = import ./_nixgl-wrappers.nix { inherit pkgs; };
in
{
  home.packages = [
    (wrapped.mkWrappedBinary {
      name = "hoppscotch";
      package = pkgs.hoppscotch;
    })
  ];
}
```

- [ ] **Step 2: Run the structure check to verify it fails the desired design**

Run: `sed -n '1,220p' modules/programs/packages.nix`
Expected: inline `wrapped.mkWrappedBinary` entries still appear directly inside `home.packages`

- [ ] **Step 3: Write the minimal implementation**

Update the `let` block so each GUI package is bound once and can be reused later:

```nix
let
  wrapped = import ./_nixgl-wrappers.nix { inherit pkgs; };

  mpvWrapped = wrapped.mkWrappedBinary {
    name = "mpv";
    package = pkgs.mpv;
  };

  obsidianWrapped = wrapped.mkWrappedBinary {
    name = "obsidian";
    package = pkgs.obsidian;
  };

  hoppscotchWrapped = wrapped.mkWrappedBinary {
    name = "hoppscotch";
    package = pkgs.hoppscotch;
  };

  nautilusWrapped = wrapped.mkWrappedBinary {
    name = "nautilus";
    package = pkgs.nautilus;
  };

  vicinaeWrapped = wrapped.mkWrappedBinary {
    name = "vicinae";
    package = pkgs.vicinae;
  };

  gimpWrapped = wrapped.mkWrappedBinary {
    name = "gimp";
    package = pkgs.gimp;
  };
in
```

Then reuse those bindings:

```nix
  programs.mpv = {
    enable = true;
    package = mpvWrapped;
  };

  programs.obsidian = {
    enable = true;
    package = obsidianWrapped;
  };

  home.packages = [
    hoppscotchWrapped
    nautilusWrapped
    vicinaeWrapped
    gimpWrapped
  ];
```

- [ ] **Step 4: Run a file check to verify the refactor landed**

Run: `sed -n '1,260p' modules/programs/packages.nix`
Expected: all six wrapped GUI packages are defined in the `let` block and reused by name later in the file

- [ ] **Step 5: Commit**

```bash
git add modules/programs/packages.nix
git commit -m "refactor(nix): reuse wrapped gui packages"
```

### Task 2: Add desktop entries for wrapped GUI applications

**Files:**
- Modify: `modules/programs/packages.nix`
- Test: `modules/programs/packages.nix`

- [ ] **Step 1: Write the failing behavior check**

Confirm there are no `xdg.desktopEntries` definitions in `modules/programs/packages.nix`, which explains why the wrapped GUI apps do not appear in the launcher.

Expected missing block:

```nix
  xdg.desktopEntries = {
    mpv = { ... };
    obsidian = { ... };
  };
```

- [ ] **Step 2: Run the behavior check to verify it fails**

Run: `rg -n "xdg\\.desktopEntries" modules/programs/packages.nix`
Expected: no matches

- [ ] **Step 3: Write the minimal implementation**

Append desktop entries using the wrapped binaries as `Exec` targets:

```nix
  xdg.desktopEntries = {
    mpv = {
      name = "mpv";
      genericName = "Media Player";
      comment = "Lightweight media player";
      exec = "${mpvWrapped}/bin/mpv";
      terminal = false;
      categories = [
        "AudioVideo"
        "Video"
        "Player"
      ];
      icon = "mpv";
      startupNotify = true;
    };

    obsidian = {
      name = "Obsidian";
      genericName = "Knowledge Base";
      comment = "Markdown knowledge base";
      exec = "${obsidianWrapped}/bin/obsidian";
      terminal = false;
      categories = [
        "Office"
        "Utility"
      ];
      icon = "obsidian";
      startupNotify = true;
    };

    hoppscotch = {
      name = "Hoppscotch";
      genericName = "API Client";
      comment = "Open source API development ecosystem";
      exec = "${hoppscotchWrapped}/bin/hoppscotch";
      terminal = false;
      categories = [
        "Development"
        "Network"
      ];
      icon = "hoppscotch";
      startupNotify = true;
    };

    nautilus = {
      name = "Files";
      genericName = "File Manager";
      comment = "Browse files and folders";
      exec = "${nautilusWrapped}/bin/nautilus";
      terminal = false;
      categories = [
        "GNOME"
        "GTK"
        "Core"
        "Utility"
        "FileManager"
      ];
      icon = "org.gnome.Nautilus";
      startupNotify = true;
    };

    vicinae = {
      name = "Vicinae";
      genericName = "Utility";
      comment = "Launch Vicinae through the nixGL wrapper";
      exec = "${vicinaeWrapped}/bin/vicinae";
      terminal = false;
      categories = [
        "Utility"
      ];
      icon = "vicinae";
      startupNotify = true;
    };

    gimp = {
      name = "GIMP";
      genericName = "Image Editor";
      comment = "Create images and edit photographs";
      exec = "${gimpWrapped}/bin/gimp";
      terminal = false;
      categories = [
        "Graphics"
        "2DGraphics"
        "RasterGraphics"
      ];
      icon = "gimp";
      startupNotify = true;
    };
  };
```

- [ ] **Step 4: Run a file check to verify the entries landed**

Run: `sed -n '1,320p' modules/programs/packages.nix`
Expected: one `xdg.desktopEntries` attrset exists with six app entries and each `exec` points to a wrapped binary path

- [ ] **Step 5: Commit**

```bash
git add modules/programs/packages.nix
git commit -m "feat(nix): add desktop entries for wrapped gui apps"
```

### Task 3: Verify Nix evaluation and generated desktop entries

**Files:**
- Modify: `modules/programs/packages.nix`
- Test: `modules/programs/packages.nix`

- [ ] **Step 1: Write the failing verification target**

Define the expected verification outcome before running commands:

```text
Home Manager evaluation should succeed without syntax errors, and the desktop entry names should be present in the generated configuration.
```

- [ ] **Step 2: Run the evaluation command**

Run: `home-manager build --flake .`
Expected: build succeeds and produces a new generation result without Nix syntax or option errors

- [ ] **Step 3: Run the desktop entry verification command**

Run: `find result/home-files/.local/share/applications -maxdepth 1 -type f | sort`
Expected:

```text
result/home-files/.local/share/applications/gimp.desktop
result/home-files/.local/share/applications/hoppscotch.desktop
result/home-files/.local/share/applications/mpv.desktop
result/home-files/.local/share/applications/nautilus.desktop
result/home-files/.local/share/applications/obsidian.desktop
result/home-files/.local/share/applications/vicinae.desktop
```

- [ ] **Step 4: Run the exec-target verification command**

Run: `rg -n "Exec=" result/home-files/.local/share/applications/{mpv,obsidian,hoppscotch,nautilus,vicinae,gimp}.desktop`
Expected: each file contains an `Exec=` line that points to the corresponding wrapped binary in the Nix store

- [ ] **Step 5: Commit**

```bash
git add modules/programs/packages.nix
git commit -m "test(nix): verify desktop entries for wrapped gui apps"
```
