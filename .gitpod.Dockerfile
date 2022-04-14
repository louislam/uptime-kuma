FROM gitpod/workspace-node

USER root

# Install Curl
# Install Apprise, add sqlite3 cli for debugging in the future, iputils-ping for ping, util-linux for setpriv
RUN apt update && \
    apt --yes --no-install-recommends install python3 python3-pip python3-cryptography python3-six python3-yaml python3-click python3-markdown python3-requests python3-requests-oauthlib \
    sqlite3 iputils-ping util-linux dumb-init && \
    pip3 --no-cache-dir install apprise==0.9.7 && \
    rm -rf /var/lib/apt/lists/*

# Install cloudflared
RUN curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && \
    apt update && \
    apt --yes --no-install-recommends install ./cloudflared.deb && \
    rm -rf /var/lib/apt/lists/* && \
    rm -f cloudflared.deb

USER gitpod
