############################################
# Build in Node.js (Alpine)
############################################
FROM node:22-alpine AS build
WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1

# Build tools are required to compile native npm modules on Alpine (musl)
RUN apk add --no-cache python3 make g++

COPY .npmrc .npmrc
COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm ci

# Build the frontend, then drop the dev dependencies to keep the image small
COPY . .
RUN npm run build && \
    npm prune --omit=dev && \
    mkdir ./data

############################################
# ⭐ Main Image (Alpine)
############################################
FROM node:22-alpine AS release
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/mbovo/uptime-kuma"

ENV UPTIME_KUMA_IS_CONTAINER=1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1

# Runtime dependencies (SQLite only, no MariaDB)
# sqlite = for debugging
# ca-certificates = keep the certs up-to-date
# iputils = for ping
# util-linux = for setpriv
# dumb-init = avoid zombie processes (#480)
# curl = for debugging
# sudo = for privilege management
# tzdata = timezone support
# python3/py3-pip = for apprise notifications
RUN apk add --no-cache \
        sqlite \
        ca-certificates \
        iputils \
        util-linux \
        dumb-init \
        curl \
        sudo \
        tzdata \
        python3 \
        py3-pip && \
    python3 -m venv /opt/apprise && \
    /opt/apprise/bin/pip install --no-cache-dir apprise && \
    ln -s /opt/apprise/bin/apprise /usr/local/bin/apprise

# Copy app files from build layer
COPY --chown=node:node --from=build /app /app

EXPOSE 3001
HEALTHCHECK --interval=60s --timeout=30s --start-period=180s --retries=5 CMD node extra/healthcheck.js
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server/server.js"]

############################################
# Rootless Image
############################################
FROM release AS rootless
USER node
