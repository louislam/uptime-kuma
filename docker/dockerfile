FROM louislam/uptime-kuma:base-debian AS build
WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1

COPY . .
RUN npm ci --production && \
    chmod +x /app/extra/entrypoint.sh


FROM louislam/uptime-kuma:base-debian AS release
WORKDIR /app

# Copy app files from build layer
COPY --from=build /app /app

EXPOSE 3001
VOLUME ["/app/data"]
HEALTHCHECK --interval=60s --timeout=30s --start-period=180s --retries=5 CMD node extra/healthcheck.js
ENTRYPOINT ["/usr/bin/dumb-init", "--", "extra/entrypoint.sh"]
CMD ["node", "server/server.js"]


FROM release AS nightly
RUN npm run mark-as-nightly


# Upload the artifact to Github
FROM louislam/uptime-kuma:base-debian AS upload-artifact
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

