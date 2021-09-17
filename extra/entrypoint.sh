#!/usr/bin/env sh

set -e

files_ownership () {
    chown -hRc "${PUID=1000}":"${PGID=1000}" /app/data
}

echo "==> Performing startup jobs and maintenance tasks"
files_ownership

echo "==> Starting application with user ${PUID=1000} group ${PGID=1000}"
exec setpriv --reuid "${PUID=1000}" --regid "${PGID=1000}" --clear-groups "$@"
