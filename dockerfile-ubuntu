# OS
FROM ubuntu:latest
# Set version label
LABEL maintainer="github.com/Dofamin"
LABEL image="Uptime Kuma"
LABEL OS="Ubuntu/latest"
# ARG & ENV
WORKDIR /srv/uptime-kuma/
ENV TZ=Europe/Moscow
# Update system packages:
RUN apt -y update > /dev/null 2>&1;\
# Fix for select tzdata region
    ln -fs /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone > /dev/null 2>&1;\
    dpkg-reconfigure --frontend noninteractive tzdata > /dev/null 2>&1;\
# Install dependencies, you would need common set of tools.
    apt -y install git curl git npm > /dev/null 2>&1;\
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - > /dev/null 2>&1;\
    apt -y install nodejs > /dev/null 2>&1;\
    npm install pm2@latest -g > /dev/null 2>&1;\
    pm2 startup > /dev/null 2>&1;\
# # Clone the repo:    
    git clone https://github.com/louislam/uptime-kuma.git git  > /dev/null 2>&1; \
    mv git/* . > /dev/null 2>&1;
# # Start installer    
RUN npm run setup > /dev/null 2>&1;\
    npm install --legacy-peer-deps && node node_modules/esbuild/install.js && npm run build && npm prune > /dev/null 2>&1
# Volume
VOLUME [ "/srv/uptime-kuma/data" ] 
# HEALTHCHECK
HEALTHCHECK --interval=60s --timeout=30s --start-period=300s CMD node extra/healthcheck.js
# Expose Ports:
EXPOSE 3001
# CMD
CMD ["/usr/bin/node",  "server/server.js"]
