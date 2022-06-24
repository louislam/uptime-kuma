# DON'T UPDATE TO alpine3.13, 1.14, see #41.
FROM node:16-alpine3.12
WORKDIR /app

# Install apprise, iputils for non-root ping, setpriv
RUN apk add --no-cache iputils setpriv dumb-init python3 py3-cryptography py3-pip py3-six py3-yaml py3-click py3-markdown py3-requests py3-requests-oauthlib && \
    pip3 --no-cache-dir install apprise==0.9.8.3 && \
    rm -rf /root/.cache

# Install grpcurl
# Can be used like ./grpcurl
RUN wget https://github.com/fullstorydev/grpcurl/releases/download/v1.8.6/grpcurl_1.8.6_linux_x86_64.tar.gz
RUN tar xf grpcurl_1.8.6_linux_x86_64.tar.gz
