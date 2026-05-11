FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl gnupg \
    && curl -fsSL https://binaries.twingate.com/client/linux/install.sh | bash \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY checker.js server.js ./

ENV PORT=8788
ENV TWINGATE_PROXY_URL=http://127.0.0.1:9999

EXPOSE 8788
CMD ["node", "server.js"]
