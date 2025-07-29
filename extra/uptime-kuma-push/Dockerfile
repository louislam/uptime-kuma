FROM node AS build
RUN useradd --create-home kuma
USER kuma
WORKDIR /home/kuma
ARG TARGETPLATFORM
COPY --chown=kuma:kuma ./build/ ./build/
COPY --chown=kuma:kuma build.js build.js
RUN node build.js $TARGETPLATFORM

FROM debian:bookworm-slim AS release
RUN useradd --create-home kuma
USER kuma
WORKDIR /home/kuma
COPY --from=build /home/kuma/uptime-kuma-push ./uptime-kuma-push

ENTRYPOINT ["/home/kuma/uptime-kuma-push"]


