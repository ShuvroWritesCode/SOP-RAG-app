FROM node:20-slim AS builder

WORKDIR /app

# Install build tools needed for native modules (e.g. pg, bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    wkhtmltopdf \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/views ./views
COPY --from=builder /app/public ./public 2>/dev/null || true

# Writable runtime directories (mounted as volumes in compose)
RUN mkdir -p storage conversations conversations-metadata

EXPOSE 3000

CMD ["node", "dist/main"]
