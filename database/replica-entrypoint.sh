#!/bin/sh
set -eu

if [ ! -s /var/lib/postgresql/data/PG_VERSION ]; then
  rm -rf /var/lib/postgresql/data/*
  PGPASSWORD="$REPLICATION_PASSWORD" pg_basebackup -h "$PRIMARY_HOST" -U "$REPLICATION_USER" -D /var/lib/postgresql/data -Fp -Xs -P -R
  echo "host all all 0.0.0.0/0 scram-sha-256" >> /var/lib/postgresql/data/pg_hba.conf
fi

chown -R postgres:postgres /var/lib/postgresql/data
chmod 700 /var/lib/postgresql/data
exec su-exec postgres postgres