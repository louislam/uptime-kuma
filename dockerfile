# DON'T UPDATE TO alpine3.13, 1.14, see #41.
FROM node:14-alpine3.12 AS release
WORKDIR /app

# split the sqlite install here, so that it can caches the arm prebuilt
RUN apk add --no-cache --virtual .build-deps make g++ python3 python3-dev && \
            ln -s /usr/bin/python3 /usr/bin/python && \
            npm install sqlite3@5.0.2 bcrypt@5.0.1 && \
            apk del .build-deps

# Touching above code may causes sqlite3 re-compile again, painful slow.

# Install apprise
# Hate pip!!! I never run pip install successfully in first run for anything in my life without Google :/
# Compilation Fail 1 => Google Search "alpine ffi.h" => Add libffi-dev
# Compilation Fail 2 => Google Search "alpine cargo" => Add cargo
# Compilation Fail 3 => Google Search "alpine opensslv.h" => Add openssl-dev
# Compilation Fail 4 => Google Search "alpine opensslv.h" again => Change to libressl-dev musl-dev
# Compilation Fail 5 => Google Search "ERROR: libressl3.3-libtls-3.3.3-r0: trying to overwrite usr/lib/libtls.so.20 owned by libretls-3.3.3-r0." again => Change back to openssl-dev with musl-dev
# Runtime Error => ModuleNotFoundError: No module named 'six' => pip3 install six
# Runtime Error 2 => ModuleNotFoundError: No module named 'six' => apk add py3-six
ENV CRYPTOGRAPHY_DONT_BUILD_RUST=1
RUN apk add --no-cache python3 py3-pip py3-six cargo
RUN apk add --no-cache --virtual .build-deps libffi-dev musl-dev openssl-dev python3-dev && \
            pip3 install apprise && \
            apk del .build-deps
RUN apprise --version

# New things add here

COPY . .
RUN npm install
RUN npm run build

EXPOSE 3001
VOLUME ["/app/data"]
HEALTHCHECK --interval=60s --timeout=30s --start-period=300s CMD node extra/healthcheck.js
CMD ["npm", "run", "start-server"]

FROM release AS nightly
RUN npm run mark-as-nightly
