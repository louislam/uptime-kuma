#example build command:
#start in the root dir
#podman build -t non-root -f docker/alpine-non-root.dockerfile .
#create build image
FROM node:16-alpine AS build
#standardverzeichnis
WORKDIR /app

#or download
COPY . .
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