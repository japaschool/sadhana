FROM node:22-bookworm-slim AS web
WORKDIR /app
COPY app-react/package.json app-react/package-lock.json ./
RUN npm ci
COPY app-react/ ./
RUN npm run build

FROM rust:1.91.1 AS chef
ARG GIT_SHA

RUN apt-get update && apt-get -y install --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Installing cargo-chef that helps to cache rust dependencies
RUN wget -qO- https://github.com/LukeMathWalker/cargo-chef/releases/download/v0.1.77/cargo-chef-x86_64-unknown-linux-gnu.tar.xz | tar -xJf-
RUN chmod +x cargo-chef-x86_64-unknown-linux-gnu/cargo-chef
RUN cp cargo-chef-x86_64-unknown-linux-gnu/cargo-chef /usr/local/cargo/bin/

WORKDIR /usr/src/sadhana-pro

FROM chef AS planner
ARG GIT_SHA
COPY . .
# Compiling the dependencies list
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS build
ARG GIT_SHA

# Building dependencies in a caching layer
COPY --from=planner /usr/src/sadhana-pro/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

WORKDIR /usr/src/sadhana-pro

COPY . .

RUN touch .env
RUN cargo build --release

COPY --from=web /app/dist dist
RUN SHORT_SHA=$(echo "$GIT_SHA" | cut -c1-8) && \
    sed -i "s/__GIT_SHA__/$SHORT_SHA/g" dist/service_worker.js


FROM gcr.io/distroless/cc-debian13
ARG GIT_SHA

# Copying postgres cient libraries
# Source: https://github.com/i0n/distroless-libpq5-debian-11/blob/main/Dockerfile

### /usr/lib/x86_64-linux-gnu
#COPY --from=build /usr/lib/x86_64-linux-gnu/* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libpq.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libgssapi_krb5.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libldap-2.5.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libldap.so.2 /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libkrb5.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libk5crypto.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libkrb5support.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/liblber-2.5.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/liblber.so.2 /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libsasl2.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libgnutls.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libp11-kit.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libidn2.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libunistring.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libtasn1.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libnettle.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libhogweed.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libgmp.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libffi.so* /usr/lib/x86_64-linux-gnu/

### /lib/x86_64-linux-gnu
#COPY --from=build /lib/x86_64-linux-gnu/* /lib/x86_64-linux-gnu/
COPY --from=build /lib/x86_64-linux-gnu/libcom_err.so.2 /lib/x86_64-linux-gnu/libcom_err.so.2
COPY --from=build /lib/x86_64-linux-gnu/libcom_err.so.2.1 /lib/x86_64-linux-gnu/libcom_err.so.2.1
COPY --from=build /lib/x86_64-linux-gnu/libkeyutils.so.1 /lib/x86_64-linux-gnu/libkeyutils.so.1
COPY --from=build /lib/x86_64-linux-gnu/libkeyutils.so.1.10 /lib/x86_64-linux-gnu/libkeyutils.so.1.10

COPY --from=build /usr/src/sadhana-pro/target/release/server /usr/local/bin/server
COPY --from=build /usr/src/sadhana-pro/dist /usr/local/bin/dist
COPY --from=build /usr/src/sadhana-pro/.env /usr/local/bin/.env

WORKDIR /usr/local/bin
ENV GIT_SHA=$GIT_SHA
CMD [ "server" ]