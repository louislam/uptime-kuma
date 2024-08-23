# DON'T UPDATE TO bullseye-slim, see #372.
# There is no 20-buster-slim for armv7 unfortunately, 18-buster-slim is the last one for Uptime Kuma v1.
FROM node:18-buster-slim
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
    pip3 --no-cache-dir install apprise==1.6.0 && \
    rm -rf /var/lib/apt/lists/* && \
    apt --yes autoremove

# Install cloudflared
RUN set -eux && \
    mkdir -p --mode=0755 /usr/share/keyrings && \
    curl --fail --show-error --silent --location --insecure https://pkg.cloudflare.com/cloudflare-main.gpg --output /usr/share/keyrings/cloudflare-main.gpg && \
    echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared buster main' | tee /etc/apt/sources.list.d/cloudflared.list && \
    apt-get update && \
    apt-get install --yes --no-install-recommends cloudflared && \
    cloudflared version && \
    rm -rf /var/lib/apt/lists/* && \
    apt --yes autoremove

# For nscd
COPY ./docker/etc/nscd.conf /etc/nscd.conf
COPY ./docker/etc/sudoers /etc/sudoers

