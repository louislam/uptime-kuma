# Simple Dockerfile for Uptime Kuma
FROM node:20-bookworm-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        sqlite3 \
        ca-certificates \
        iputils-ping \
        dumb-init \
        curl && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get autoremove -y

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev --legacy-peer-deps

# Create data directory
RUN mkdir -p ./data

# Set environment variables
ENV NODE_ENV=production
ENV UPTIME_KUMA_IS_CONTAINER=1

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=60s --timeout=30s --start-period=180s --retries=5 \
    CMD curl -f http://localhost:3001/api/entry-page || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "server/server.js"]
