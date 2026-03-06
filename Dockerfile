# Docker Configuration for Sentinel-OS | Hardened Edition

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

# --- 🛡️ ENGINEERING BASIC: NON-ROOT USER ---
RUN groupadd -r sentinel && useradd -r -g sentinel sentinel
RUN mkdir -p /app/server/logs && chown -R sentinel:sentinel /app

COPY --from=builder --chown=sentinel:sentinel /app/dist ./dist
COPY --from=builder --chown=sentinel:sentinel /app/server ./server
COPY --from=builder --chown=sentinel:sentinel /app/intelligence ./intelligence
COPY --from=builder --chown=sentinel:sentinel /app/package*.json ./

USER sentinel

WORKDIR /app/server
RUN npm install --omit=dev

EXPOSE 3002

# --- 🏥 NATIVE NODE HEALTHCHECK ---
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "index.js"]
