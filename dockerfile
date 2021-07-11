FROM node:14

WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

EXPOSE 3001
VOLUME ["/app/data"]
CMD ["npm", "run", "start-server"]
