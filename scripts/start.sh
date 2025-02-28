#!/bin/sh

# Wait for database to be ready
while ! nc -z $DATABASE_HOST $DATABASE_PORT; do
  echo "Waiting for database connection..."
  sleep 1
done

# Run migrations
pnpm prisma migrate deploy

# Start the application
pnpm start 