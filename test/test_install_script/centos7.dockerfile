FROM centos:7

RUN useradd -ms /bin/bash test_user
USER test_user
WORKDIR /home/test_user

COPY ./install.sh .
RUN ls
RUN bash install.sh local /opt/uptime-kuma 3000 0.0.0.0
