#!/bin/bash
# Filename: index.sh
PUSH_URL="https://example.com/api/push/key?status=up&msg=OK&ping="
INTERVAL=60
METHOD="GET"

while true; do
    curl -s -o /dev/null -X $METHOD $PUSH_URL
    echo "Pushed!"
    sleep $INTERVAL
done
