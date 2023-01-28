############################################
# Build in Golang
# Run npm run build-healthcheck-armv7 in the host first, another it will be super slow where it is building the armv7 healthcheck
############################################
FROM golang:1.19-buster
WORKDIR /app
ARG TARGETPLATFORM
COPY ./extra/ ./extra/

# Compile healthcheck.go
RUN apt update && \
    apt --yes --no-install-recommends install curl && \
    curl -sL https://deb.nodesource.com/setup_18.x | bash && \
    apt --yes --no-install-recommends install nodejs && \
    node ./extra/build-healthcheck.js $TARGETPLATFORM && \
    apt --yes remove nodejs
