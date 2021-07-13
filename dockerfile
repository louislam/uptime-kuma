FROM node:14-alpine3.14

# sqlite have to build on arm
RUN apk add --no-cache make g++ python3
RUN ln -s /usr/bin/python3 /usr/bin/python

WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

EXPOSE 3001
VOLUME ["/app/data"]
CMD ["npm", "run", "start-server"]
