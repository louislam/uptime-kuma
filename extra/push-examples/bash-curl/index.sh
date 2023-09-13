#!/bin/bash
PUSH_URL="https://status.kuma.pet/api/push/XhQE4b4dGI?status=up&msg=OK&ping="
INTERVAL=60

while true; do
    curl -s -o /dev/null $PUSH_URL
    echo "Pushed!"
    sleep $INTERVAL
done
