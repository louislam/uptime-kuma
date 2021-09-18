#!/usr/bin/env sh

set -e
PUID=${PUID=1000}
PGID=${PGID=1000}

files_ownership () {
    chown -hRc "$PUID":"$PGID" /app/data
}

echo "==> Performing startup jobs and maintenance tasks"
files_ownership

echo "==> Starting application with user $PUID group $PGID"
exec setpriv --reuid "$PUID" --regid "$PGID" --clear-groups "$@"
