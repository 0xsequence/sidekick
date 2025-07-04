# Use an official Node.js runtime as the base image
FROM node:24-alpine

# Set the working directory in the container
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Install netcat for database health check
RUN apk add --no-cache netcat-openbsd

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the application
RUN pnpm run build

# Make start script executable
RUN chmod +x scripts/start.sh

# Expose the port the app runs on
EXPOSE 7500

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=7500

# Command to run the application
CMD ["/app/scripts/start.sh"]