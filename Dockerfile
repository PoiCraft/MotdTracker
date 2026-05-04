# ---- Stage 1: Builder ----
# Uses a Rust image with Node.js installed so that build.rs can run
# `npm ci` + `npm run build` to compile the React frontend, which is
# then embedded into the binary via rust-embed at compile time.
FROM rust:alpine3.22 AS builder

# Install Node.js LTS
#RUN apt-get update && apt-get install -y --no-install-recommends \
#        curl ca-certificates \
#    && curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
#    && apt-get install -y --no-install-recommends nodejs \
#    && rm -rf /var/lib/apt/lists/*
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Pre-install npm dependencies for better layer caching.
# build.rs skips `npm ci` when frontend/node_modules already exists.
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix frontend

# Copy the rest of the source and build the release binary.
# build.rs will run `npm run build` (node_modules already present)
# and embed the resulting dist/ into the binary.
COPY . .

# Accept git metadata as build args so that build.rs can embed the correct
# version string even though .git is excluded from the Docker build context.
ARG GIT_COMMIT_HASH=unknown
ARG GIT_COMMIT_TIME=
RUN GIT_COMMIT_HASH=${GIT_COMMIT_HASH} GIT_COMMIT_TIME=${GIT_COMMIT_TIME} cargo build --release

# ---- Stage 2: Runtime ----
FROM alpine:3.22 AS runtime

# Install minimal runtime packages. `su-exec` is a tiny substitute for `gosu` on Alpine.
RUN apk add --no-cache ca-certificates su-exec

WORKDIR /app

# Copy only the compiled binary and the entrypoint helper
COPY --from=builder /app/target/release/motdtracker .
COPY entrypoint.sh /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Create the default data directory for the SQLite database
RUN mkdir -p data

# Create the unprivileged runtime user (busybox addgroup/adduser available in Alpine)
RUN addgroup -S motdtracker \
    && adduser -S -u 10001 -G motdtracker -h /app -s /bin/false motdtracker \
    && chown motdtracker:motdtracker /app/data

# Persist the SQLite database across container restarts
VOLUME ["/app/data"]

# Default listen port (matches the default in AppConfig)
EXPOSE 5011

# entrypoint.sh runs as root, fixes /app/data ownership, then drops to the
# motdtracker user via gosu before executing the application.
#
# Mount your config.toml at /app/config.toml before starting.
# Example:
#   docker run -v ./config.toml:/app/config.toml \
#              -v motdtracker_data:/app/data \
#              -p 5011:5011 ghcr.io/poicraft/motdtracker
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["./motdtracker"]
