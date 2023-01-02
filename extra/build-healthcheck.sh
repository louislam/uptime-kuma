#!/bin/bash

set -e

if [[ $# -ne 1 ]]; then
    echo "No platform specified"
    exit 1
fi

if [ "$1" == "linux/arm/v7" ]; then
    echo "Arch: armv7"
    if [ -f "./extra/healthcheck-armv7" ]; then
        mv "./extra/healthcheck-armv7" "./extra/healthcheck"
        echo "Already built on the host, skip."
        exit 0
    else
        echo "WARNING: prebuilt ARM healthcheck not found, build will be slow! You should execute \`npm run build-healthcheck-armv7\` before build."
    fi
else
    if [ -f "./extra/healthcheck-armv7" ]; then
        rm "./extra/healthcheck-armv7"
    fi
fi

echo "Building healthcheck..."
go build -x -o ./extra/healthcheck ./extra/healthcheck.go
echo "Done!"
