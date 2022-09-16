# You can find the new timestamped tags here: https://hub.docker.com/r/gitpod/workspace-full/tags
FROM gitpod/workspace-full:2022-09-11-15-11-40

USER root

RUN apt-get update -q && export DEBIAN_FRONTEND=noninteractive
RUN apt-get install -y git=1:2.37.3-0ppa1~ubuntu20.04.1 && apt-get clean && rm -rf /var/lib/apt/lists/*

USER gitpod
