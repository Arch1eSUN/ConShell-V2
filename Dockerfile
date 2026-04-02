# Stage 1: Builder
FROM node:24-bookworm AS builder

WORKDIR /app

# Copy package manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Prepare pnpm using corepack (reads pinned version from package.json)
RUN corepack enable && corepack install

# Install build dependencies for native add-ons (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 make g++ sqlite3 libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the entire project context (respecting .dockerignore)
COPY . .

# Install dependencies and force building better-sqlite3 from source
ENV PNPM_IGNORE_WORKSPACE_ROOT_CHECK=true
ENV PNPM_SKIP_CATALOG_CHECK=true
RUN pnpm install --frozen-lockfile
RUN npm_config_build_from_source=true pnpm rebuild better-sqlite3

# Build the application
RUN pnpm build


# Stage 2: Runner
FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV CONSHELL_HOME=/root/.conshell

# Prepare pnpm in runner (reads pinned version from package.json)
COPY --from=builder /app/package.json ./
RUN corepack enable && corepack install

# Install sqlite runtime dependencies (slim to keep image small)
RUN apt-get update && apt-get install -y \
    sqlite3 libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy built artifacts from builder
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Create persistence directory
RUN mkdir -p $CONSHELL_HOME && chmod -R 777 $CONSHELL_HOME

# Expose default application port
EXPOSE 4200

# Health check — verify API is responsive
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:4200/api/system/summary').then(r=>{if(!r.ok)throw 1})" || exit 1

# Start the server (not REPL!)
CMD ["node", "packages/cli/dist/index.js", "start"]
