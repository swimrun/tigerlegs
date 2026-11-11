# API-only image: the static frontend is served by GitHub Pages.
# Node.js runs the TypeScript directly (type stripping), so there is no build step and no dependency to install.
FROM node:24-alpine

WORKDIR /app
COPY package.json ./
COPY src/server ./src/server
COPY src/shared ./src/shared

ENV NODE_ENV=production \
    PORT=8123 \
    CACHE_PATH=/data/terrain_cache \
    STATIC_DIR=/nonexistent \
    ALLOWED_ORIGINS=https://swimrun.group,http://localhost:8123

RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 8123

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/v1/health || exit 1

CMD ["node", "src/server/server.ts"]
