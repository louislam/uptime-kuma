# DON'T UPDATE TO node:14-bullseye-slim, see #372.
# If the image changed, the second stage image should be changed too
FROM node:18-buster-slim AS base2-slim
ARG TARGETPLATFORM

# Install Curl
# Install Apprise, add sqlite3 cli for debugging in the future, iputils-ping for ping, util-linux for setpriv
# Stupid python3 and python3-pip actually install a lot of useless things into Debian, specify --no-install-recommends to skip them.
RUN apt update && \
    apt --yes --no-install-recommends install python3 python3-pip python3-cryptography python3-six python3-yaml python3-click python3-markdown python3-requests python3-requests-oauthlib \
        sqlite3 iputils-ping util-linux dumb-init git && \
    pip3 --no-cache-dir install apprise==1.2.1 && \
    rm -rf /var/lib/apt/lists/* && \
    apt --yes autoremove

# Install cloudflared
# dpkg --add-architecture arm: cloudflared do not provide armhf, this is workaround. Read more: https://github.com/cloudflare/cloudflared/issues/583
COPY extra/download-cloudflared.js ./extra/download-cloudflared.js
RUN node ./extra/download-cloudflared.js $TARGETPLATFORM && \
    dpkg --add-architecture arm && \
    apt update && \
    apt --yes --no-install-recommends install ./cloudflared.deb && \
    rm -rf /var/lib/apt/lists/* && \
    rm -f cloudflared.deb && \
    apt --yes autoremove

FROM base2-slim AS base2
RUN apt update && \
    apt --yes --no-install-recommends install curl && \
    curl -LsS https://r.mariadb.com/downloads/mariadb_repo_setup | bash -s -- --mariadb-server-version="mariadb-10.11" && \
    apt --yes --no-install-recommends install mariadb-server && \
    apt --yes remove curl && \
    rm -rf /var/lib/apt/lists/* && \
    apt --yes autoremove
RUN chown -R node:node /var/lib/mysql
ENV UPTIME_KUMA_ENABLE_EMBEDDED_MARIADB=1
