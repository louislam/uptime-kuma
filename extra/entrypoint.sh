#!/usr/bin/env sh

# set -e Exit the script if an error happens
set -e
PUID=${PUID=0}
PGID=${PGID=0}

files_ownership () {
    # -h Changes the ownership of an encountered symbolic link and not that of the file or directory pointed to by the symbolic link.
    # -R Recursively descends the specified directories
    # -c Like verbose but report only when a change is made
    chown -hRc "$PUID":"$PGID" /app/data
}


# When running as non root, most tests will work just fine, but we are unable
# to chown (needed if we change the PUID/PGID between runs using the same data
# volume), and unable to setpriv.
#
# This depends on the data volume being created - on first run - with the
# correct file ownership and permissions.
#
# If the container starts as non-root we display a warning and then run
# "as-is" if it's acknowledged.
#
if [ "$(id -u)" -ne "0" ]; then
  echo "Container is not running as root; this is not yet supported but"
  echo "a best effort can be made to continue regardless."
  echo

  if [ "${UNSUPPORTED}" != "yes" ]; then
    echo "Please set an environment variable UNSUPPORTED=yes to confirm"
    echo "that you wish to continue in this unsupported configuration."
    return 1
  fi

  exec "$@"
fi



# ... else continue as normal.

echo "==> Performing startup jobs and maintenance tasks"
files_ownership

echo "==> Starting application with user $PUID group $PGID"

# --clear-groups Clear supplementary groups.
exec setpriv --reuid "$PUID" --regid "$PGID" --clear-groups "$@"
