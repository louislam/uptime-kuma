#!/usr/bin/env sh

# set -e Exit the script if an error happens
set -e
DATADIR=/app/data

files_ownership () {
    # Check if the $DATADIR folder is owned by the user invoking the container
    if [ $(stat -c%u "$DATADIR") !=  $(id -u) ]; then
        echo "File ownership incorrect, attempting to fix."
        chown -hRc "$(id -u)":"$(id -g)" $DATADIR || echo "ERROR: Failed to set file ownership. Please run 'sudo chown -R $(id -u):$(id -g) /path/to/container/volume' to resolve."; exit 1
        echo "File ownership fix succesful! Continuing."
    fi

   # Checks for R/W permissions
   if [ $(stat -c%a "$DATADIR") -ne 770 ]; then
        echo "Directory permissions incorrect, attempting to fix."
        find $DATADIR -type d -exec chmod 770 {} \;

        # Re-run the check
        if [ $(stat -c%a "$DATADIR") -ne 770 ]; then
                echo "ERROR: Failed to set file permissions. Please run 'sudo find /path/to/container/volume -type d chmod 770 {} \;' to resolve."
                exit 1
        fi
        echo "Directory permission fix succesful! Continuing."
   fi

   # Check the R/W permissions on the files
   if [ $(stat -c%a "$DATADIR"/* | head -n 1) != 640 ]; then
        echo "File permissions incorrect. Attempting to fix."
        find $DATADIR -type f -exec chmod 640 {} \;

        # Re-run the check
        if [ $(stat -c%a "$DATADIR"/* | head -n 1) != 640 ]; then
                echo "ERROR: Failed to set file permissions. Please run 'sudo find /path/to/container/volume -type f chmod 640 {} \;' to resolve."
                exit 1
        fi
        echo "File permission fix succesful! Continuing."
   fi
}

echo "==> Performing startup jobs and maintenance tasks"
echo "==> Checking file permissions"
files_ownership

echo "==> Starting application as user: $(id -u) ($USER) and group $(id -g)"

# --clear-groups Clear supplementary groups.
if [ $(id -u) -eq 0 ];
then
        # We're running as root, so we can use setpriv without problems.
        exec setpriv --reuid "$PUID" --regid "$PGID" --clear-groups "$@"
else
        # We're running as a regular user, so we'll launch the app as one.
        exec "$@"
fi
