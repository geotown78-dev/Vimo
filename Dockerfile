# Multi-stage build for Vimo WebRTC & Signaling Server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package definitions
COPY package*.json ./

# Install dependencies (with legacy-peer-deps to prevent peer dependency resolution errors)
RUN npm install --legacy-peer-deps

# Copy source code and assets
COPY . .

# Build production client bundle into /app/dist
RUN npm run build

# Runner Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package definitions
COPY package*.json ./

# Copy installed node_modules directly from builder to avoid duplicate download & resolution errors
COPY --from=builder /app/node_modules ./node_modules

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy server and runtime configs
COPY server.ts ./
COPY tsconfig.json ./
COPY public ./public
COPY src ./src

# Expose standard web/signaling port
EXPOSE 3000

# Healthcheck to verify the server is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Start the full-stack server
CMD ["npm", "start"]
