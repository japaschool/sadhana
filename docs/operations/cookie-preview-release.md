# Cookie Preview Release Deployment Topology

## Baseline Inventory

Date: 2026-04-24

Production-server changes are documented here as manual instructions only.

### Confirmed from repo

- `.github/workflows/build_dockerhub.yml` builds `japaschool/sadhana:latest` and `japaschool/sadhana:git-<sha>`, then SSHes to run `/home/sadhana/scripts/sadhana_reload.sh git-<sha>`.
- `.github/workflows/run_latest.yml` SSHes to the same reload script with no explicit tag argument, which means the script defaults to `latest`.
- `Dockerfile` produces a single runtime image that starts one `server` process and serves the built frontend from the same container image.
- `server/src/main.rs` currently runs Diesel migrations on startup.
- `server/src/routes.rs` serves the built frontend from `./dist`.

### Confirmed from remote deploy script

Script path: `/home/sadhana/scripts/sadhana_reload.sh`

```bash
#!/bin/bash
shopt -s expand_aliases
source /home/sadhana/.bashrc
export DOCKER_HOST="unix:///run/user/1108/docker.sock"

TAG=${1:-latest}
export SADHANA_TAG="$TAG"

cd ~/docker/
docker compose pull sadhana
docker compose up -d

echo "$(date -Is) $SADHANA_TAG" >> ~/logs/deployments.log

docker image prune --all --force
sleep 5
docker compose ps
```

Operational conclusions:

- Deployment is Docker Compose based.
- The current reload flow updates a single Compose service named `sadhana`.
- `docker compose ps` confirms the live container name is also `sadhana`.
- The selected image tag is injected through `SADHANA_TAG`.
- The script assumes one live application slot, not parallel `stable` and `preview` slots.

## Topology Notes

Production nginx config path: `~/docker/nginx.conf`

`~/docker/nginx.conf` is the operational nginx source file that must be edited manually for this deployment.

Stable Compose service / container / nginx upstream host: `sadhana`

Stable upstream target: `http://sadhana:8080`

Preview Compose service / container / nginx upstream host to add: `sadhana-preview`

Preview upstream target to add: `http://sadhana-preview:8080`

Local app port for both stable and preview inside the Docker network: `8080`

Published port for `sadhana` service: none

The app service is not host-published; nginx reaches it over the Docker network at `sadhana:8080`.

## Verified Live Nginx Behavior

- `server_name`: `app.sadhana.pro mapp.sadhana.pro`
- Hashed static assets (`.wasm`, `.js`, `.css`) proxy to `http://sadhana:8080`
- `/api/` proxies to `http://sadhana:8080`
- `/` proxies to `http://sadhana:8080`
- Static assets force `Cache-Control: public, max-age=31536000, immutable`
- SPA fallback forces `Cache-Control: no-cache, must-revalidate`
- Proxy requests use HTTP/1.1 with `Connection "close"`
- Proxy headers currently include `Host` and `X-Forwarded-For`

## Manual Production Change Scope

Future changes to the production deploy script, Docker Compose configuration, or nginx configuration for this deployment must be made manually on the production server.
