# Stage 1: Builder
FROM public.ecr.aws/docker/library/node:24.12.0-alpine3.23 AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code and build
COPY . .

RUN npm run build

# Prune dev dependencies to keep only production dependencies
RUN npm prune --production

# Stage 2: Runner
FROM public.ecr.aws/docker/library/node:24.12.0-alpine3.23

WORKDIR /app
# Copy package files
COPY package.json package-lock.json* ./

# Copy production dependencies and built application from build stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

CMD ["node", "dist/server.js"]
