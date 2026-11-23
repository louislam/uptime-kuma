############################################
# Build in Golang
############################################
FROM golang:1-trixie
WORKDIR /app
ARG TARGETPLATFORM
COPY ./extra/ ./extra/

# Compile healthcheck.go
RUN apt update && \
    apt --yes --no-install-recommends install curl && \
    curl -sL https://deb.nodesource.com/setup_24.x | bash && \
    apt --yes --no-install-recommends install nodejs && \
    node ./extra/build-healthcheck.js $TARGETPLATFORM && \
    apt --yes remove nodejs
