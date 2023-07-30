# If the image changed, the second stage image should be changed too
FROM node:18-bullseye-slim AS base2-slim
ARG TARGETPLATFORM

WORKDIR /app

# Specify --no-install-recommends to skip unused dependencies, make the base much smaller!
# python3* = apprise's dependencies
# sqlite3 = for debugging
# iputils-ping = for ping
# util-linux = for setpriv (Should be dropped in 2.0.0?)
# dumb-init = avoid zombie processes (#480)
# curl = for debugging
# ca-certificates = keep the cert up-to-date
# sudo = for start service nscd with non-root user
# nscd = for better DNS caching
# (pip) apprise = for notifications
RUN apt-get update && \
    apt-get --yes --no-install-recommends install  \
        python3 python3-pip python3-cryptography python3-six python3-yaml python3-click python3-markdown python3-requests python3-requests-oauthlib \
        sqlite3  \
        iputils-ping  \
        util-linux  \
        dumb-init  \
        curl  \
        ca-certificates \
        sudo \
        nscd && \
    pip3 --no-cache-dir install apprise==1.4.5 && \
    rm -rf /var/lib/apt/lists/* && \
    apt --yes autoremove


# Install cloudflared
RUN curl https://pkg.cloudflare.com/cloudflare-main.gpg --output /usr/share/keyrings/cloudflare-main.gpg && \
    echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bullseye main' | tee /etc/apt/sources.list.d/cloudflared.list && \
    apt update && \
    apt install --yes --no-install-recommends cloudflared && \
    cloudflared version && \
    rm -rf /var/lib/apt/lists/* && \
    apt --yes autoremove

# For nscd
COPY ./docker/etc/nscd.conf /etc/nscd.conf
COPY ./docker/etc/sudoers /etc/sudoers


# Full Base Image
# MariaDB, Chromium and fonts
# Not working for armv7, so use the older version (10.5) of MariaDB from the debian repo
# curl -LsS https://r.mariadb.com/downloads/mariadb_repo_setup | bash -s -- --mariadb-server-version="mariadb-11.1" && \
FROM base2-slim AS base2
ENV UPTIME_KUMA_ENABLE_EMBEDDED_MARIADB=1
RUN apt update && \
    apt --yes --no-install-recommends install chromium fonts-indic fonts-noto fonts-noto-cjk mariadb-server && \
    apt --yes remove curl && \
    rm -rf /var/lib/apt/lists/* && \
    apt --yes autoremove && \
    chown -R node:node /var/lib/mysql
