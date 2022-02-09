#!/usr/bin/env sh

# set -e Exit the script if an error happens
set -e

#Setting the PUID and PGID variable to the ID's we've actually launched as, instead of some passed environment variable.
PUID=$(id -u)
PGID=$(id -g)

files_ownership () {
    # -h Changes the ownership of an encountered symbolic link and not that of the file or directory pointed to by the symbolic link.
    # -R Recursively descends the specified directories
    # -c Like verbose but report only when a change is made
    chown -hRc "$PUID":"$PGID" /app/data
}

echo "==> Performing startup jobs and maintenance tasks"
files_ownership

echo "==> Starting application with user $PUID group $PGID"

# --clear-groups Clear supplementary groups.
if [ $(id -u) -eq 0 ];
then
	#We're running as root, so we can use setpriv without problems.
	exec setpriv --reuid "$PUID" --regid "$PGID" --clear-groups "$@"
else
	#We're running as a regular user, so we'll launch the app as one.
	exec "$@"
fi
