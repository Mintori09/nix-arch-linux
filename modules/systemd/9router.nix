{ config, pkgs, ... }:

let
  composeFile = "${config.home.homeDirectory}/.config/9router/docker-compose.yml";
in
{
  home.packages = with pkgs; [
    docker-compose
  ];

  systemd.user.startServices = "sd-switch";

  home.file.".config/9router/docker-compose.yml".text = ''
    services:
      9router:
        image: antiantiops/9router:latest
        container_name: 9router
        ports:
          - "20128:20128"
        volumes:
          - ${config.home.homeDirectory}/.local/share/9router:/app/data
        environment:
          DATA_DIR: /app/data
          PORT: "20128"
          HOSTNAME: "0.0.0.0"
          NODE_ENV: production
        restart: unless-stopped
  '';

  home.activation.create9routerDataDir = ''
    mkdir -p ${config.home.homeDirectory}/.local/share/9router
  '';

  systemd.user.services."9router-docker" = {
    Unit = {
      Description = "9Router via Docker Compose";
      After = [ "default.target" ];
    };

    Service = {
      Type = "oneshot";
      RemainAfterExit = true;
      WorkingDirectory = "${config.home.homeDirectory}/.config/9router";
      ExecStart = "${pkgs.docker-compose}/bin/docker-compose -f ${composeFile} up -d";
      ExecStop = "${pkgs.docker-compose}/bin/docker-compose -f ${composeFile} stop";
    };

    Install = {
      WantedBy = [ "default.target" ];
    };
  };
}
