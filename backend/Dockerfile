# Use official Node.js LTS image
FROM node:22-alpine AS base

# Install OpenSSL for Prisma compatibility
RUN apk add --no-cache openssl libc6-compat

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Build the application
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build TypeScript
RUN npm run build

# Drop dev-only packages from the runtime payload. `prisma` (CLI used by the
# entrypoint for migrate deploy) and the generated client stay because they are
# regular dependencies. --ignore-scripts keeps the generated client untouched.
RUN npm prune --omit=dev --ignore-scripts

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Copy entrypoint script
COPY --chown=nodejs:nodejs entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set user to nodejs
USER nodejs

# PORT is injected by the platform (Railway); do not hard-code it
# Start the application with migrations
CMD ["/usr/local/bin/entrypoint.sh"]
