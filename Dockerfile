# Production Dockerfile for PartyTube (Unified Client + Server)
FROM node:20-slim AS builder

WORKDIR /app

# Copy all source files (avoids Buildah wildcard resolution bugs)
COPY . .

# Install dependencies for both client and server
RUN npm run install:all

# Build both client (Vite) and server (TypeScript)
RUN npm run build

# Production Runtime Stage
FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Copy root and server package files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server/package.json ./server/

# Install only production dependencies for server
RUN npm --prefix server install --omit=dev

# Copy compiled production artifacts from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Expose the application port
EXPOSE 4000

CMD ["node", "server/dist/index.js"]
