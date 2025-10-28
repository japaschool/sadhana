FROM rust:1.84.0 AS chef

# Tool versions (override at build time with --build-arg if needed)
ARG CARGO_CHEF_VERSION=v0.1.71
ARG TRUNK_VERSION=v0.21.13
ARG WASM_BINDGEN_VERSION=0.2.100

# Install minimal packages and clean apt lists to keep image small
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates wget libpq5 \
	&& rm -rf /var/lib/apt/lists/*

# Add wasm target used by frontend build
RUN rustup target add wasm32-unknown-unknown

# Install cargo-chef, trunk and wasm-bindgen (pinned versions).
RUN set -eux; \
	wget -qO /tmp/cargo-chef.tar.gz https://github.com/LukeMathWalker/cargo-chef/releases/download/${CARGO_CHEF_VERSION}/cargo-chef-x86_64-unknown-linux-gnu.tar.gz; \
	tar -xzf /tmp/cargo-chef.tar.gz -C /tmp; \
	chmod +x /tmp/cargo-chef; \
	mv /tmp/cargo-chef /usr/local/cargo/bin/cargo-chef; \
	\
	wget -qO /tmp/trunk.tar.gz https://github.com/thedodd/trunk/releases/download/${TRUNK_VERSION}/trunk-x86_64-unknown-linux-gnu.tar.gz; \
	tar -xzf /tmp/trunk.tar.gz -C /tmp; \
	chmod +x /tmp/trunk; \
	mv /tmp/trunk /usr/local/cargo/bin/trunk; \
	\
	wget -qO /tmp/wasm-bindgen.tar.gz https://github.com/rustwasm/wasm-bindgen/releases/download/${WASM_BINDGEN_VERSION}/wasm-bindgen-${WASM_BINDGEN_VERSION}-x86_64-unknown-linux-musl.tar.gz; \
	tar -xzf /tmp/wasm-bindgen.tar.gz -C /tmp; \
	chmod +x /tmp/wasm-bindgen-${WASM_BINDGEN_VERSION}-x86_64-unknown-linux-musl/wasm-bindgen; \
	chmod +x /tmp/wasm-bindgen-${WASM_BINDGEN_VERSION}-x86_64-unknown-linux-musl/wasm2es6js; \
	mv /tmp/wasm-bindgen-${WASM_BINDGEN_VERSION}-x86_64-unknown-linux-musl/wasm-bindgen /usr/local/cargo/bin/wasm-bindgen; \
	mv /tmp/wasm-bindgen-${WASM_BINDGEN_VERSION}-x86_64-unknown-linux-musl/wasm2es6js /usr/local/cargo/bin/wasm2es6js; \
	\
	rm -rf /tmp/*

WORKDIR /usr/src/sadhana-pro

FROM chef AS planner
COPY . .
# Compiling the dependencies list for server and frontend
# Server recipe
RUN cargo chef prepare --recipe-path recipe_server.json
RUN sh -c "cd frontend; cargo chef prepare --recipe-path recipe_wasm.json"

FROM chef AS build

# Building dependencies in a caching layer
COPY --from=planner /usr/src/sadhana-pro/frontend/recipe_wasm.json frontend/recipe_wasm.json
COPY --from=planner /usr/src/sadhana-pro/recipe_server.json recipe_server.json

# Cook server deps
RUN cargo chef cook --release --recipe-path recipe_server.json
# Cook frontend deps first (will populate cargo cache for frontend crate)
RUN sh -c "cd frontend; CARGO_TARGET_DIR=../target cargo chef cook --profile release --target wasm32-unknown-unknown --recipe-path recipe_wasm.json"

WORKDIR /usr/src/sadhana-pro

COPY . .

# Avoid shipping a secrets-filled .env; create an empty placeholder if missing
RUN test -f .env || touch .env

RUN ./scripts/build_info.sh

# Build frontend (trunk) and the Rust server. Use --locked to respect Cargo.lock.
RUN cd frontend && trunk build --release
RUN cargo build --release --locked

# Strip binary to reduce size (safe for statically-linked / release builds)
RUN strip target/release/server || true

# Create a tarball with runtime dependencies (shared libraries) detected by ldd.
# Also write a readable list runtime-deps.txt for logging/inspection.
RUN set -eux; \
		ldd target/release/server | awk '{for(i=1;i<=NF;i++) if ($i ~ /^\//) {print $i; break}}' | sort -u > runtime-deps.txt || true; \
		if [ -s runtime-deps.txt ]; then \
			echo "Detected runtime libs:"; cat runtime-deps.txt; \
			xargs -a runtime-deps.txt tar -czf runtime-deps.tar.gz; \
		else \
			echo "No external runtime libs detected by ldd." > runtime-deps.txt; \
		fi

FROM debian:bookworm-slim

# Install runtime packages (libpq and certificates). Keep image small.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates libpq5 \
	&& rm -rf /var/lib/apt/lists/*

# Copy server binary and frontend static files
COPY --from=build /usr/src/sadhana-pro/target/release/server /usr/local/bin/server
COPY --from=build /usr/src/sadhana-pro/dist /usr/local/bin/dist

# Optionally extract runtime-deps created in the build stage (only if present).
# This handles any additional .so files ldd reported that aren't provided by apt.
COPY --from=build /usr/src/sadhana-pro/runtime-deps.tar.gz /tmp/runtime-deps.tar.gz
COPY --from=build /usr/src/sadhana-pro/runtime-deps.txt /tmp/runtime-deps.txt
RUN if [ -f /tmp/runtime-deps.tar.gz ]; then \
			echo "== runtime-deps.txt contents (from build stage) =="; cat /tmp/runtime-deps.txt || true; \
			echo "Extracting runtime-deps.tar.gz..."; \
			tar -xzf /tmp/runtime-deps.tar.gz -C / ; \
			rm /tmp/runtime-deps.tar.gz; rm /tmp/runtime-deps.txt; \
		else \
			echo "No runtime-deps.tar.gz provided; runtime-deps.txt:"; cat /tmp/runtime-deps.txt || true; \
			rm -f /tmp/runtime-deps.txt; \
		fi

# Create a non-root user and give ownership of app files
RUN groupadd -r sadhana && useradd -r -g sadhana -d /nonexistent -s /usr/sbin/nologin sadhana \
	&& chown -R sadhana:sadhana /usr/local/bin/dist /usr/local/bin/server || true

WORKDIR /usr/local/bin

# Run as non-root
USER sadhana

CMD ["/usr/local/bin/server"]