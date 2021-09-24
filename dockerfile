# DON'T UPDATE TO node:14-bullseye-slim, see #372.
# If the image changed, the second stage image should be changed too
FROM node:14-buster-slim AS build
WORKDIR /app

COPY . .
RUN npm install --legacy-peer-deps && \
    npm run build && \
    npm prune --production && \
    chmod +x /app/extra/entrypoint.sh


FROM node:14-buster-slim AS release
WORKDIR /app

# Install Apprise, add sqlite3 cli for debugging in the future, iputils-ping for ping, util-linux for setpriv
RUN apt update && \
    apt --yes install python3 python3-pip python3-cryptography python3-six python3-yaml python3-click python3-markdown python3-requests python3-requests-oauthlib \
        sqlite3 iputils-ping util-linux && \
    pip3 --no-cache-dir install apprise && \
    rm -rf /var/lib/apt/lists/*

# Copy app files from build layer
COPY --from=build /app /app

EXPOSE 3001
VOLUME ["/app/data"]
HEALTHCHECK --interval=60s --timeout=30s --start-period=180s --retries=5 CMD node extra/healthcheck.js
ENTRYPOINT ["extra/entrypoint.sh"]
CMD ["node", "server/server.js"]

FROM release AS nightly
RUN npm run mark-as-nightly
