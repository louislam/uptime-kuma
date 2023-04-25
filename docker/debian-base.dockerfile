# DON'T UPDATE TO node:14-bullseye-slim, see #372.
# If the image changed, the second stage image should be changed too
FROM node:16-buster-slim
ARG TARGETPLATFORM

WORKDIR /app

# Install Curl
# Install Apprise, add sqlite3 cli for debugging in the future, iputils-ping for ping, util-linux for setpriv
# Stupid python3 and python3-pip actually install a lot of useless things into Debian, specify --no-install-recommends to skip them, make the base even smaller than alpine!
RUN apt-get update && \
    apt-get --yes --no-install-recommends install python3 python3-pip python3-cryptography python3-six python3-yaml python3-click python3-markdown python3-requests python3-requests-oauthlib \
        sqlite3 iputils-ping util-linux dumb-init git curl ca-certificates && \
    pip3 --no-cache-dir install apprise==1.3.0 && \
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

