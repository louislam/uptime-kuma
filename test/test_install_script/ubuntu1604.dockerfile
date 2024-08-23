FROM ubuntu:16.04

# Test invalid node version, these commands install nodejs 10
#RUN apt --yes install nodejs
# RUN ln -s /usr/bin/nodejs /usr/bin/node
# RUN node -v

COPY ./install.sh .
RUN bash install.sh local /opt/uptime-kuma 3000 0.0.0.0
