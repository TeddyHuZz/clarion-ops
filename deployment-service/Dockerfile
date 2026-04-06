# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts and production dependencies only
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

# Environment
ENV NODE_ENV=production
ENV PORT=8003

EXPOSE 8003

CMD ["node", "dist/index.js"]
