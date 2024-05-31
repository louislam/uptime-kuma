FROM louislam/uptime-kuma:builder-go AS build_healthcheck
FROM louislam/uptime-kuma:base-debian AS build
WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
COPY .npmrc .npmrc
COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm ci --omit=dev
COPY . .
COPY --from=build_healthcheck /app/extra/healthcheck /app/extra/healthcheck

FROM louislam/uptime-kuma:base-debian AS release
WORKDIR /app

ENV UPTIME_KUMA_IS_CONTAINER=1

# Copy app files from build layer
COPY --from=build /app /app


EXPOSE 3001
VOLUME ["/app/data"]
HEALTHCHECK --interval=60s --timeout=30s --start-period=180s --retries=5 CMD extra/healthcheck
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server/server.js"]
