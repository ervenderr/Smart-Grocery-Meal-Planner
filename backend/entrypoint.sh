#!/usr/bin/env sh
set -e

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy --schema=prisma/schema.prisma

# Start the application
echo "Starting application..."
npm start
