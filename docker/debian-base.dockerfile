# DON'T UPDATE TO node:14-bullseye-slim, see #372.
# If the image changed, the second stage image should be changed too
FROM node:16-buster-slim
ARG TARGETPLATFORM

WORKDIR /app

# Install Curl
# Install Apprise, add sqlite3 cli for debugging in the future, iputils-ping for ping, util-linux for setpriv
# Stupid python3 and python3-pip actually install a lot of useless things into Debian, specify --no-install-recommends to skip them, make the base even smaller than alpine!
RUN apt update && \
    apt --yes --no-install-recommends install python3 python3-pip python3-cryptography python3-six python3-yaml python3-click python3-markdown python3-requests python3-requests-oauthlib \
        sqlite3 iputils-ping util-linux dumb-init && \
    pip3 --no-cache-dir install apprise==0.9.8.3 && \
    rm -rf /var/lib/apt/lists/*

# Install cloudflared
# dpkg --add-architecture arm: cloudflared do not provide armhf, this is workaround. Read more: https://github.com/cloudflare/cloudflared/issues/583
COPY extra/download-cloudflared.js ./extra/download-cloudflared.js
RUN node ./extra/download-cloudflared.js $TARGETPLATFORM && \
    dpkg --add-architecture arm && \
    apt update && \
    apt --yes --no-install-recommends install ./cloudflared.deb && \
    rm -rf /var/lib/apt/lists/* && \
    rm -f cloudflared.deb

