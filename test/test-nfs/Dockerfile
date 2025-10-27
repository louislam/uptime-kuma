FROM node:trixie-slim
RUN apt update && apt --yes install nfs-common
RUN mkdir /mnt/public
WORKDIR /app
COPY index.mjs index.mjs
