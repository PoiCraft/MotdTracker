# ---- Stage 1: Builder ----
# Uses a Rust image with Node.js installed so that build.rs can run
# `npm ci` + `npm run build` to compile the React frontend, which is
# then embedded into the binary via rust-embed at compile time.
FROM rust:1-slim-bookworm AS builder

# Install Node.js LTS
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pre-install npm dependencies for better layer caching.
# build.rs skips `npm ci` when frontend/node_modules already exists.
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix frontend

# Copy the rest of the source and build the release binary.
# build.rs will run `npm run build` (node_modules already present)
# and embed the resulting dist/ into the binary.
COPY . .
RUN cargo build --release

# ---- Stage 2: Runtime ----
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates gosu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only the compiled binary and the entrypoint helper
COPY --from=builder /app/target/release/motdtracker .
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create the default data directory for the SQLite database
RUN mkdir -p data

# Create the unprivileged runtime user.
# chown the data dir so anonymous Docker volumes are initialised with the
# correct ownership; the entrypoint.sh re-applies chown for bind mounts.
RUN useradd -r -u 10001 -s /bin/false motdtracker \
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
