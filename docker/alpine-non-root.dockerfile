#create build image
FROM node:16-alpine AS build
#standardverzeichnis
WORKDIR /app

#or download
RUN wget https://github.com/louislam/uptime-kuma/archive/refs/tags/1.15.1.tar.gz && \
    tar xvzf 1.15.1.tar.gz && \
    mv uptime-kuma-1.15.1/* . && \
    rm -rf uptime-kuma-1.15.1 1.15.1.tar.gz

#--production do not work bc : vite not found
#RUN npm install --production
RUN npm install
RUN npm run build

#create release image
FROM node:16-alpine AS release
WORKDIR /app
USER node
#improve this
COPY --from=build /app /app

EXPOSE 3001
VOLUME ["/app/data"]
HEALTHCHECK --interval=60s --timeout=30s --start-period=180s --retries=5 CMD node extra/healthcheck.js

CMD ["node", "server/server.js"]