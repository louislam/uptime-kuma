FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl gnupg iputils-ping \
    && curl -fsSL https://binaries.twingate.com/client/linux/install.sh | bash \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --omit=dev --no-audit --no-fund \
    http-proxy-agent@7.0.2 \
    https-proxy-agent@7.0.6 \
    socks-proxy-agent@8.0.5

COPY checker.js server.js twingate-lifecycle.js twingate-service-key.js ./

ENV PORT=8788

EXPOSE 8788
CMD ["node", "server.js"]
