ARG BASE_IMAGE=louislam/uptime-kuma:base2

############################################
# Build in Golang
# Run npm run build-healthcheck-armv7 in the host first, otherwise it will be super slow where it is building the armv7 healthcheck
# Check file: builder-go.dockerfile
############################################
FROM louislam/uptime-kuma:builder-go AS build_healthcheck

############################################
# Build in Node.js
############################################
FROM louislam/uptime-kuma:base2 AS build
USER node
WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
COPY --chown=node:node .npmrc .npmrc
COPY --chown=node:node package.json package.json
COPY --chown=node:node package-lock.json package-lock.json
RUN npm ci --omit=dev
COPY . .
COPY --chown=node:node --from=build_healthcheck /app/extra/healthcheck /app/extra/healthcheck
RUN mkdir ./data

############################################
# ⭐ Main Image
############################################
FROM $BASE_IMAGE AS release
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/louislam/uptime-kuma"

ENV UPTIME_KUMA_IS_CONTAINER=1

# Copy app files from build layer
COPY --chown=node:node --from=build /app /app

EXPOSE 3001
HEALTHCHECK --interval=60s --timeout=30s --start-period=180s --retries=5 CMD extra/healthcheck
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server/server.js"]

############################################
# Rootless Image
############################################
FROM release AS rootless
USER node

############################################
# Mark as Nightly
############################################
FROM release AS nightly
RUN npm run mark-as-nightly

FROM nightly AS nightly-rootless
USER node

############################################
# Build an image for testing pr
############################################
FROM louislam/uptime-kuma:base2 AS pr-test2
WORKDIR /app
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1

## Install Git
RUN apt update \
    && apt --yes --no-install-recommends install curl \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt update \
    && apt --yes --no-install-recommends  install git

## Empty the directory, because we have to clone the Git repo.
RUN rm -rf ./* && chown node /app

USER node
RUN git config --global user.email "no-reply@no-reply.com"
RUN git config --global user.name "PR Tester"
RUN git clone https://github.com/louislam/uptime-kuma.git .

# Hide the warning when running in detached head state
RUN git config --global advice.detachedHead false

RUN npm ci

EXPOSE 3000 3001
HEALTHCHECK --interval=60s --timeout=30s --start-period=180s --retries=5 CMD extra/healthcheck
CMD ["npm", "run", "start-pr-test"]

############################################
# Upload the artifact to Github
############################################
FROM louislam/uptime-kuma:base2 AS upload-artifact
WORKDIR /
RUN apt update && \
    apt --yes install curl file

COPY --from=build /app /app

ARG VERSION
ARG GITHUB_TOKEN
ARG TARGETARCH
ARG PLATFORM=debian
ARG FILE=$PLATFORM-$TARGETARCH-$VERSION.tar.gz
ARG DIST=dist.tar.gz

RUN chmod +x /app/extra/upload-github-release-asset.sh

# Full Build
# RUN tar -zcvf $FILE app
# RUN /app/extra/upload-github-release-asset.sh github_api_token=$GITHUB_TOKEN owner=louislam repo=uptime-kuma tag=$VERSION filename=$FILE

# Dist only
RUN cd /app && tar -zcvf $DIST dist
RUN /app/extra/upload-github-release-asset.sh github_api_token=$GITHUB_TOKEN owner=louislam repo=uptime-kuma tag=$VERSION filename=/app/$DIST

