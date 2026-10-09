# Base Image (Slim)
# If the image changed, the second stage image should be changed too
FROM node:26-trixie-slim AS base3-slim
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

# apprise = for notifications (installed from upstream PyPI via uv, since Debian's stable package is too old) (workaround for #4867)
# paho-mqtt is installed for the mqtt:// plugin (#4859)
# slixmpp is installed for the xmpp:// plugin (#7361)
# APPRISE_VERSION is a PEP 440 specifier (uv/pip use PEP 440, not npm semver); ~=2.0.1 accepts >=2.0.1,<2.1.0
ARG APPRISE_VERSION="~=2.0.1"
RUN apt update && \
    apt --yes --no-install-recommends install python3 && \
    rm -rf /var/lib/apt/lists/* && \
    curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh && \
    UV_TOOL_BIN_DIR=/usr/local/bin UV_TOOL_DIR=/opt/uv-tools uv tool install "apprise${APPRISE_VERSION}" \
        --with paho-mqtt \
        --with "slixmpp>=1.16.0" && \
    apt --yes autoremove && \
    apprise --version

# Install cloudflared
RUN curl https://pkg.cloudflare.com/cloudflare-main.gpg --output /usr/share/keyrings/cloudflare-main.gpg && \
    echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | tee /etc/apt/sources.list.d/cloudflared.list && \
    apt update && \
    apt install --yes --no-install-recommends cloudflared && \
    cloudflared version && \
    rm -rf /var/lib/apt/lists/* && \
    apt --yes autoremove

# For nscd
COPY ./docker/etc/nscd.conf /etc/nscd.conf
COPY ./docker/etc/sudoers /etc/sudoers

# Debian bookworm does not have Let's Encrypt's Gen Y root certs.
# Not sure if it is the best solution, and not sure if Debian will add them in the future, but for now we can just add them manually.
RUN curl -fsSL https://letsencrypt.org/certs/gen-y/root-ye.pem -o /usr/local/share/ca-certificates/isrg-root-ye.crt && \
    curl -fsSL https://letsencrypt.org/certs/gen-y/root-yr.pem -o /usr/local/share/ca-certificates/isrg-root-yr.crt && \
    update-ca-certificates

# Full Base Image
# MariaDB, Chromium and fonts
# Make sure to reuse the slim image here. Uncomment the above line if you want to build it from scratch.
FROM louislam/uptime-kuma:base3-slim AS base3
ENV UPTIME_KUMA_ENABLE_EMBEDDED_MARIADB=1
RUN apt update && \
    apt --yes --no-install-recommends install chromium fonts-indic fonts-noto fonts-noto-cjk mariadb-server && \
    rm -rf /var/lib/apt/lists/* && \
    apt --yes autoremove && \
    chown -R node:node /var/lib/mysql
