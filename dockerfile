FROM node:14-alpine3.14
WORKDIR /app

RUN apk add --no-cache make g++ python3 py3-pip python3-dev
RUN ln -s /usr/bin/python3 /usr/bin/python

# split the sqlite install here, so that it can caches the arm prebuilt
RUN npm install sqlite3@5.0.2

COPY . .
RUN npm install
RUN npm run build

# Remove built tools
RUN apk del make g++

EXPOSE 3001
VOLUME ["/app/data"]
CMD ["npm", "run", "start-server"]
