FROM louislam/uptime-kuma:base-debian AS build
WORKDIR /app

COPY . .
RUN npm install --legacy-peer-deps && \
    npm run build && \
    npm prune --production && \
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
FROM node:14-buster-slim AS upload-artifact
WORKDIR /
RUN apt update && \
    apt --yes install curl file

ARG GITHUB_TOKEN
ARG TARGETARCH
ARG PLATFORM=debian
ARG VERSION=1.5.0


COPY --from=build /app /app

RUN FILE=uptime-kuma.tar.gz
RUN tar -czf $FILE app

RUN curl \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Content-Type: $(file -b --mime-type $FILE)" \
    --data-binary @$FILE \
    "https://uploads.github.com/repos/louislam/uptime-kuma/releases/$VERSION/assets?name=$(basename $FILE)"

