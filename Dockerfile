FROM node:16.4.2-alpine3.14
WORKDIR /app
COPY . .
RUN yarn --frozen-lockfile
RUN yarn build
# 
FROM node:16.4.2-alpine3.14
WORKDIR /app
VOLUME ["/app/data"]
EXPOSE 50013
COPY package.json yarn.lock ./
COPY ./db /app/db
COPY ./server /app/server
RUN yarn --frozen-lockfile --prod
RUN yarn cache clean
COPY --from=0 /app/dist /app/dist
ENTRYPOINT ["node", "server/server.js"]
