# Docker Configuration for Sentinel-OS

# 1. Build Stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm install
COPY . .
RUN npm run build

# 2. Runtime Stage
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/intelligence ./intelligence
COPY --from=builder /app/package*.json ./

WORKDIR /app/server
RUN npm install --omit=dev

EXPOSE 3002
CMD ["node", "index.js"]
