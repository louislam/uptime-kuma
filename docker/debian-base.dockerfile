# Download Apprise deb package
FROM node:20-bookworm-slim AS download-apprise
WORKDIR /app
COPY ./extra/download-apprise.mjs ./download-apprise.mjs
RUN apt update && \
    apt --yes --no-install-recommends install curl && \
    npm install cheerio semver && \
    node ./download-apprise.mjs

# Base Image (Slim)
# If the image changed, the second stage image should be changed too
FROM node:20-bookworm-slim AS base2-slim
ARG TARGETPLATFORM

# Specify --no-install-recommends to skip unused dependencies, make the base much smaller!
# sqlite3 = for debugging
# iputils-ping = for ping
# util-linux = for setpriv (Should be dropped in 2.0.0?)
# dumb-init = avoid zombie processes (#480)
# curl = for debugging
# ca-certificates = keep the cert up-to-date
# sudo = for start service nscd with non-root user
# nscd = for better DNS caching
RUN apt update && \
    apt --yes --no-install-recommends install  \
        sqlite3  \
        ca-certificates \
        iputils-ping  \
        util-linux  \
        dumb-init  \
        curl  \
        sudo \
        nscd && \
    rm -rf /var/lib/apt/lists/* && \
    apt --yes autoremove

# apprise = for notifications (Install from the deb package, as the stable one is too old) (workaround for #4867)
# Switching to testing repo is no longer working, as the testing repo is not bookworm anymore.
# python3-paho-mqtt (#4859)
# TODO: no idea how to delete the deb file after installation as it becomes a layer already
COPY --from=download-apprise /app/apprise.deb ./apprise.deb
RUN apt update && \
    apt --yes --no-install-recommends install ./apprise.deb python3-paho-mqtt && \
    rm -rf /var/lib/apt/lists/* && \
    rm -f apprise.deb && \
    apt --yes autoremove

# Install cloudflared
RUN curl https://pkg.cloudflare.com/cloudflare-main.gpg --output /usr/share/keyrings/cloudflare-main.gpg && \
    echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main' | tee /etc/apt/sources.list.d/cloudflared.list && \
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
# Make sure to reuse the slim image here. Uncomment the above line if you want to build it from scratch.
# FROM base2-slim AS base2
FROM louislam/uptime-kuma:base2-slim AS base2
ENV UPTIME_KUMA_ENABLE_EMBEDDED_MARIADB=1
RUN apt update && \
    apt --yes --no-install-recommends install chromium fonts-indic fonts-noto fonts-noto-cjk mariadb-server && \
    rm -rf /var/lib/apt/lists/* && \
    apt --yes autoremove && \
    chown -R node:node /var/lib/mysql
