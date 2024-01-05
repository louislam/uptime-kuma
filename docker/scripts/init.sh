#!/bin/bash

PUID=${PUID:-1000}
PGID=${PGID:-1000}

groupmod -o -g "$PGID" node
usermod -o -u "$PUID" node

echo "node has uid: $(id -u node) and gid: $(id -g node)"
echo "dropping to node user"

exec sudo -u node node server/server.js
