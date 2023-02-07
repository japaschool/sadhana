FROM rust:latest as build

RUN apt update
RUN apt install -y libpq5

RUN rustup target add wasm32-unknown-unknown
RUN cargo install trunk wasm-bindgen-cli

WORKDIR /usr/src/sadhana-pro

COPY . .

RUN cd frontend && trunk build --release
RUN cargo build --release

FROM gcr.io/distroless/cc-debian11

# Copying postgres cient libraries
# Source: https://github.com/i0n/distroless-libpq5-debian-11/blob/main/Dockerfile

### /usr/lib/x86_64-linux-gnu
#COPY --from=build /usr/lib/x86_64-linux-gnu/* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libpq.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libgssapi_krb5.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libldap_r-2.4.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libkrb5.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libk5crypto.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libkrb5support.so* /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/liblber-2.4.so* /usr/lib/x86_64-linux-gnu/
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
COPY --from=build /lib/x86_64-linux-gnu/libkeyutils.so.1.9 /lib/x86_64-linux-gnu/libkeyutils.so.1.9

COPY --from=build /usr/src/sadhana-pro/target/release/server /usr/local/bin/server
COPY --from=build /usr/src/sadhana-pro/dist /usr/local/bin/dist
COPY --from=build /usr/src/sadhana-pro/.env /usr/local/bin/.env

WORKDIR /usr/local/bin
CMD [ "server" ]