{ pkgs }:
{
  config = {
    sound = true;
    notification = true;
    bell = false;
    timeout = 5;
    showProjectName = true;
    showFullPath = false;
    showSessionTitle = false;
    showIcon = true;
    suppressWhenFocused = true;
    enableOnDesktop = false;
    notificationSystem = "osascript";
    linux.grouping = false;
    minDuration = 0;
    command = {
      enabled = false;
    };
  };

  packages = [ pkgs.pulseaudio ];
}
