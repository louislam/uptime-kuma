FROM node AS build
RUN useradd --create-home kuma
USER kuma
WORKDIR /home/kuma
ARG TARGETPLATFORM
COPY --chown=kuma:kuma ./build/ ./build/
COPY --chown=kuma:kuma build.js build.js
RUN node build.js $TARGETPLATFORM

FROM debian:bookworm-slim AS release
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home kuma
USER kuma
WORKDIR /home/kuma
COPY --from=build /home/kuma/uptime-kuma-push ./uptime-kuma-push

ENTRYPOINT ["/home/kuma/uptime-kuma-push"]


