{
  pkgs,
  osConfig,
  config,
  lib,
  inputs,
  ...
}:

let
  inherit (pkgs.stdenv.hostPlatform) isLinux;

  obsPackage =
    if (lib.elem "nvidia" (osConfig.services.xserver.videoDrivers or [ ])) then
      pkgs.obs-studio.override { cudaSupport = true; }
    else
      pkgs.obs-studio;

  obsWrapped = if isLinux then config.lib.nixGL.wrap obsPackage else obsPackage;
in
lib.mkIf isLinux {
  programs.obs-studio = {
    enable = true;
    package = obsWrapped;

    plugins = with pkgs.obs-studio-plugins; [
      wlrobs
      obs-vaapi
      obs-vkcapture
      obs-move-transition
      obs-pipewire-audio-capture
    ];
  };
}
