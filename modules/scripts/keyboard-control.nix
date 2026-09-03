{ config, ... }:

{
  xdg.desktopEntries.disable-laptop-keyboard = {
    name = "Disable Laptop Keyboard";
    genericName = "Disable Internal Keyboard";
    comment = "Disable internal AT keyboard via udev and atkbd unbind";
    icon = "input-keyboard-virtual";
    exec = "pkexec bash ${config.home.homeDirectory}/.config/home-manager/scripts/keyboard/disable-keyboard.sh";
    terminal = false;
    type = "Application";
    categories = [
      "Utility"
      "Settings"
    ];
  };

  xdg.desktopEntries.enable-laptop-keyboard = {
    name = "Enable Laptop Keyboard";
    genericName = "Enable Internal Keyboard";
    comment = "Enable internal AT keyboard by removing udev rule and rebinding atkbd";
    icon = "input-keyboard";
    exec = "pkexec bash ${config.home.homeDirectory}/.config/home-manager/scripts/keyboard/enable-keyboard.sh";
    terminal = false;
    type = "Application";
    categories = [
      "Utility"
      "Settings"
    ];
  };
}
