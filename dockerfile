FROM node:14-bullseye-slim AS release
WORKDIR /app

# install dependencies
RUN apt update && apt --yes install python3 python3-pip python3-dev git g++ make iputils-ping
RUN ln -s /usr/bin/python3 /usr/bin/python

# split the sqlite install here, so that it can caches the arm prebuilt
RUN npm install mapbox/node-sqlite3#593c9d

# Install apprise
RUN apt --yes install python3-cryptography python3-six python3-yaml python3-click python3-markdown python3-requests python3-requests-oauthlib
RUN pip3 --no-cache-dir install apprise && \
    rm -rf /root/.cache

# additional package should be added here, since we don't want to re-compile the arm prebuilt again

# add sqlite3 cli for debugging in the future
RUN apt --yes install sqlite3


COPY . .
RUN npm install --legacy-peer-deps && npm run build && npm prune

EXPOSE 3001
VOLUME ["/app/data"]
HEALTHCHECK --interval=60s --timeout=30s --start-period=180s --retries=5 CMD node extra/healthcheck.js
CMD ["node", "server/server.js"]

FROM release AS nightly
RUN npm run mark-as-nightly
