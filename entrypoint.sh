#!/bin/sh
set -e

# When /app/data is bind-mounted from the host Docker may create the directory
# as root, preventing the unprivileged motdtracker user from writing the SQLite
# database.  Fix ownership here (runs as root before privilege drop).
chown -R motdtracker:motdtracker /app/data || \
    echo "Warning: could not chown /app/data – database writes may fail if the directory is root-owned"

exec gosu motdtracker "$@"