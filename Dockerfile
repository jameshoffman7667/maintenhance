# ---- Stage 1: build the frontend ----
FROM node:20.19-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Leave unset for a normal root deployment. Set to something like
# "/maintenhance/" (leading AND trailing slash) to build the app for serving
# under a subpath behind a reverse proxy - see README.md.
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build

# ---- Stage 2: backend production dependencies ----
# build-essential + python3 let native modules (better-sqlite3) compile from
# source if no prebuilt binary matches. They stay in this stage only.
FROM node:20.19-slim AS backend-deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Stage 3: runtime image ----
FROM node:20.19-slim AS runtime
LABEL org.opencontainers.image.source="https://github.com/jameshoffman7667/maintenhance"

# tini is PID 1 so SIGTERM from `docker stop` reaches the app and zombie
# processes are reaped.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --chown=1000:100 --from=backend-deps /app/node_modules ./node_modules
COPY --chown=1000:100 backend/ ./
COPY --chown=1000:100 CHANGELOG.md ./CHANGELOG.md
COPY --chown=1000:100 --from=frontend-build /app/frontend/dist ./public

# SQLite database lives here - mount a volume at this path so data
# survives container rebuilds/restarts (see docker-compose.yml).
ENV DATA_DIR=/data
# Bulk files (photos, snapshots, temp files). Mount a second, slower volume
# here if you want them off the database's fast storage.
ENV FILES_DIR=/files
ENV NODE_ENV=production

# v2.10: the app runs as UID 1000 / GID 100, not root. Host folders mounted at
# /data and /files must be owned by 1000:100 (see deploy/RELEASE.md).
RUN mkdir -p /data /files && chown 1000:100 /data /files
USER 1000:100

# Default port if none is supplied at runtime. docker-compose.yml passes PORT
# as an environment variable, which overrides this.
ARG PORT=8040
ENV PORT=$PORT
EXPOSE $PORT

# Liveness check against the public, login-free /healthz endpoint. Shell form
# so ${PORT} follows the port the app was started with; 127.0.0.1 (not
# localhost) avoids an IPv6 lookup; node is used because the slim image has no
# wget or curl. The JSON body must have status "ok" (a 200 with another body
# fails). The same check is in deploy/compose.yaml and docker-compose.yml.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:${PORT}/healthz').then(r=>r.json()).then(j=>process.exit(j.status==='ok'?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
