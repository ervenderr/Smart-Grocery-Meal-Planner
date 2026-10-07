#!/usr/bin/env sh
set -e

# Run database migrations with the local prisma binary, retrying while the DB comes up
MAX_ATTEMPTS=5
attempt=1
until ./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma; do
  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "Migrations failed after $attempt attempts" >&2
    exit 1
  fi
  echo "Migration attempt $attempt failed, retrying in 3s..."
  attempt=$((attempt + 1))
  sleep 3
done

# Replace the shell so node is PID 1 and receives SIGTERM directly
echo "Starting application..."
exec node dist/index.js
