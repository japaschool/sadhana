FROM rust:1.72 as chef

# Installing postgres lib
RUN apt update
RUN apt install -y libpq5

RUN rustup target add wasm32-unknown-unknown

# Installing cargo-chef that helps to cache rust dependencies
# RUN cargo install cargo-chef
RUN wget -qO- https://github.com/LukeMathWalker/cargo-chef/releases/download/v0.1.62/cargo-chef-x86_64-unknown-linux-gnu.tar.gz | tar -xzf-
RUN chmod +x cargo-chef
RUN cp cargo-chef /usr/local/cargo/bin/

# RUN cargo install trunk wasm-bindgen-cli
RUN wget -qO- https://github.com/thedodd/trunk/releases/download/v0.17.5/trunk-x86_64-unknown-linux-gnu.tar.gz | tar -xzf-
RUN chmod +x trunk
RUN cp trunk /usr/local/cargo/bin/

RUN wget -qO- https://github.com/rustwasm/wasm-bindgen/releases/download/0.2.87/wasm-bindgen-0.2.87-x86_64-unknown-linux-musl.tar.gz | tar -xzf-
RUN chmod +x wasm-bindgen-0.2.87-x86_64-unknown-linux-musl/wasm-bindgen
RUN chmod +x wasm-bindgen-0.2.87-x86_64-unknown-linux-musl/wasm2es6js
RUN cp wasm-bindgen-0.2.87-x86_64-unknown-linux-musl/wasm-bindgen /usr/local/cargo/bin/
RUN cp wasm-bindgen-0.2.87-x86_64-unknown-linux-musl/wasm2es6js /usr/local/cargo/bin/

WORKDIR /usr/src/sadhana-pro

FROM chef AS planner
COPY . .
# Compiling the dependencies list
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS build

# Building dependencies in a caching layer
COPY --from=planner /usr/src/sadhana-pro/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

WORKDIR /usr/src/sadhana-pro

COPY . .

RUN touch .env
RUN cd frontend && trunk build --release
RUN cargo build --release

FROM gcr.io/distroless/cc-debian12

# Copying postgres cient libraries
# Source: https://github.com/i0n/distroless-libpq5-debian-11/blob/main/Dockerfile

### /usr/lib/x86_64-linux-gnu
#COPY --from=build /usr/lib/x86_64-linux-gnu/* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libpq.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libgssapi_krb5.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libldap-2.5.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libkrb5.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libk5crypto.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libkrb5support.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/liblber-2.5.so* /usr/lib/x86_64-linux-gnu/
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
CMD [ "server" ]