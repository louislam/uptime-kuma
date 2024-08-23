# Container running a test radius server
# More instructions in https://github.com/louislam/uptime-kuma/pull/1635

FROM freeradius/freeradius-server:latest

RUN mkdir -p /etc/raddb/mods-config/files/

RUN echo "client net {"                 > /etc/raddb/clients.conf
RUN echo "    ipaddr = 172.17.0.0/16"  >> /etc/raddb/clients.conf
RUN echo "    secret = testing123"     >> /etc/raddb/clients.conf
RUN echo "}"                           >> /etc/raddb/clients.conf

RUN echo "bob Cleartext-Password := \"testpw\"" > /etc/raddb/mods-config/files/authorize
