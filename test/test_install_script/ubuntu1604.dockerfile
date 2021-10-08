FROM ubuntu:16.04
RUN apt-get update
RUN apt --yes install curl

# Test invalid node version, these commands install nodejs 10
#RUN apt --yes install nodejs
# RUN ln -s /usr/bin/nodejs /usr/bin/node
# RUN node -v

RUN curl -o kuma_install.sh http://git.kuma.pet/install.sh && bash kuma_install.sh local /opt/uptime-kuma 3000 0.0.0.0
