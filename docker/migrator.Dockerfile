FROM louislam/uptime-kuma:base2-slim
WORKDIR /app
ENV UPTIME_KUMA_IS_CONTAINER=1
COPY ./extra/migrator.js ./extra/migrator.js
RUN npm install args-parser
CMD ["node", "extra/migrator.js"]
