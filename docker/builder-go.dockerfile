############################################
# Build in Golang
############################################
FROM golang:1-buster
WORKDIR /app
ARG TARGETPLATFORM
COPY ./extra/ ./extra/

## Switch to archive.debian.org
RUN sed -i '/^deb/s/^/#/' /etc/apt/sources.list \
    && echo "deb http://archive.debian.org/debian buster main contrib non-free" | tee -a /etc/apt/sources.list \
    && echo "deb http://archive.debian.org/debian-security buster/updates main contrib non-free" | tee -a /etc/apt/sources.list \
    && echo "deb http://archive.debian.org/debian buster-updates main contrib non-free" | tee -a /etc/apt/sources.list

# Compile healthcheck.go
RUN apt update && \
    apt --yes --no-install-recommends install curl && \
    curl -sL https://deb.nodesource.com/setup_18.x | bash && \
    apt --yes --no-install-recommends install nodejs && \
    go build -x -o ./extra/healthcheck ./extra/healthcheck.go && \
    apt --yes remove nodejs
