ARG VARIANT=16-bullseye
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:${VARIANT}


RUN apt-get update && export DEBIAN_FRONTEND=noninteractive
RUN apt-get install -y git && apt-get clean && rm -rf /var/lib/apt/lists/*
USER node

# run server in devcontainer terminal:
# node server/server.js 