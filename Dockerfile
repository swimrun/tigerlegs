# API-only image: the static frontend is served by GitHub Pages.
FROM denoland/deno:alpine-2.5.6

WORKDIR /app
COPY deno.json deno.lock ./
COPY src ./src

# Cache dependencies at build time so the container starts offline-capable.
RUN deno cache src/server/server.ts

ENV PORT=8123 \
    CACHE_PATH=/data/terrain_cache \
    STATIC_DIR=/nonexistent \
    ALLOWED_ORIGINS=https://swimrun.group,http://localhost:8123

RUN mkdir -p /data && chown deno:deno /data
VOLUME /data
USER deno
EXPOSE 8123

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/v1/health || exit 1

CMD ["run", "--allow-net", "--allow-read", "--allow-write=/data", "--allow-env", "src/server/server.ts"]
