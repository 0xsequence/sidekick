#!/bin/sh

# Run migrations
pnpm prisma migrate deploy

# Start the application
pnpm start
