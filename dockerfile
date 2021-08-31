# DON'T UPDATE TO alpine3.13, 1.14, see #41.
FROM node:14-alpine3.12 AS release
WORKDIR /app

# Install apprise
RUN apk add --no-cache python3 py3-cryptography py3-pip py3-six py3-yaml py3-click py3-markdown py3-requests py3-requests-oauthlib
RUN pip3 --no-cache-dir install apprise && \
            rm -rf /root/.cache

COPY . .
RUN npm install --legacy-peer-deps && npm run build && npm prune

EXPOSE 3001
VOLUME ["/app/data"]
HEALTHCHECK --interval=60s --timeout=30s --start-period=300s CMD node extra/healthcheck.js
CMD ["node", "server/server.js"]

FROM release AS nightly
RUN npm run mark-as-nightly
