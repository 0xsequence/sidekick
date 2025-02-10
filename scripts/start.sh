#!/bin/sh

echo "Waiting for PostgreSQL to be ready..."
sleep 5

echo "\n=== Database Connection Details ==="
echo "DATABASE_URL: postgresql://engine:sequence@localhost:5432/sequence_engine"
echo "============================\n"

echo "Running database migrations..."
pnpm prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "Starting the application..."
pnpm start 