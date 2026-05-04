#!/bin/sh
set -e

# When /app/data is bind-mounted from the host Docker may create the directory
# as root, preventing the unprivileged motdtracker user from writing the SQLite
# database.  Fix ownership only when necessary (avoids startup latency on large
# bind mounts).
if [ "$(stat -c '%u:%g' /app/data 2>/dev/null)" != "10001:10001" ]; then
    chown motdtracker:motdtracker /app/data || \
        echo "Warning: could not chown /app/data – database writes may fail if the directory is root-owned"
fi

exec gosu motdtracker "$@"