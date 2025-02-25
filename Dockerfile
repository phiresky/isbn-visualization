# Build rust
FROM rust:1.85 AS rust-builder
RUN apt-get update && apt-get install -y cmake
ADD scripts/rarity /app/scripts/rarity
WORKDIR /app/scripts/rarity
RUN cargo build --release

FROM rust:1.85 AS oxipng
RUN cargo install oxipng

# pnpm base
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS prod-deps
COPY . /app
WORKDIR /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# clean result
FROM base
RUN apt-get update && apt-get install -y pngquant zopfli pv zstd
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=rust-builder /app/scripts/rarity/target/release/rarity /app/scripts/rarity/target/release/rarity
COPY --from=oxipng /usr/local/cargo/bin/oxipng /usr/bin/oxipng
COPY . /app
WORKDIR /app
RUN pnpm -v # ensure pnpm is downloaded by corepack
CMD ["/app/scripts/process-all.sh"]