# You can find the new timestamped tags here: https://hub.docker.com/r/gitpod/workspace-full/tags
FROM gitpod/workspace-full:2022-09-11-15-11-40

USER root

# Install Curl, Apprise, sqlite3 cli for debugging in the future, iputils-ping for ping, util-linux for setpriv
RUN apt-get update -q \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt --yes --no-install-recommends install python3 python3-pip python3-cryptography python3-six python3-yaml \
    python3-click python3-markdown python3-requests python3-requests-oauthlib \
    git sqlite3 iputils-ping util-linux dumb-init \
    && pip3 --no-cache-dir install apprise==0.9.7 \
    && rm -rf /var/lib/apt/lists/*

# Install cloudflared
RUN curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
    && dpkg --add-architecture arm \
    && apt update \
    && apt --yes --no-install-recommends install ./cloudflared.deb \
    && rm -rf /var/lib/apt/lists/* \
    rm -f cloudflared.deb

USER gitpod

# Add Workspace/Project composer bin folder to $PATH
ENV PATH="$PATH:$GITPOD_REPO_ROOT/node_modules/.bin"
