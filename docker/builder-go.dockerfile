############################################
# Build in Golang
# Run npm run build-healthcheck-armv7 in the host first, another it will be super slow where it is building the armv7 healthcheck
############################################
FROM golang:1.19.4-buster
WORKDIR /app
ARG TARGETPLATFORM
COPY ./extra/ ./extra/

# Compile healthcheck.go
RUN apt update
RUN apt --yes --no-install-recommends install curl
RUN curl -sL https://deb.nodesource.com/setup_18.x | bash
RUN apt --yes --no-install-recommends install nodejs
RUN node -v
RUN node ./extra/build-healthcheck.js $TARGETPLATFORM
