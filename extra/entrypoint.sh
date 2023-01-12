#!/usr/bin/env sh

# set -e Exit the script if an error happens
set -ex

PUID=${PUID=0}
PGID=${PGID=0}

files_ownership () {
    # -h Changes the ownership of an encountered symbolic link and not that of the file or directory pointed to by the symbolic link.
    # -c Like verbose but report only when a change is made
    find /opt/src/app/data/ \( ! -name ".type" \) -exec chown -hc "$PUID":"$PGID" {} \;
}

echo "==> Performing startup jobs and maintenance tasks"
files_ownership

echo "==> Starting application with user $PUID group $PGID"

# --clear-groups Clear supplementary groups.
exec setpriv --reuid "$PUID" --regid "$PGID" --clear-groups "$@"

set +xe
