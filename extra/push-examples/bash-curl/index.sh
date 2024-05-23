#!/bin/bash
# Filename: index.sh
PUSH_URL="https://example.com/api/push/key?status=up&msg=OK&ping="
INTERVAL=60
HTTP_METHOD="GET"

while true; do
    curl -X $HTTP_METHOD -s -o /dev/null $PUSH_URL
    echo "Pushed!"
    sleep $INTERVAL
done
