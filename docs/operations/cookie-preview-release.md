# Cookie Preview Release Operations Runbook

## Scope

This runbook describes how to run `stable` and `preview` releases side-by-side on `app.sadhana.pro` using a cookie, without adding a second public host.

All production-server changes below are manual.

## Current Baseline

- Docker Compose services: `nginx`, `postgres`, `sadhana`
- App upstream currently used by nginx: `http://sadhana:8080`
- App service host-published port: none
- Operational nginx config file: `~/docker/nginx.conf`

## Target Topology

- Stable app service: `sadhana`
- Preview app service: `sadhana-preview`
- Stable upstream: `http://sadhana:8080`
- Preview upstream: `http://sadhana-preview:8080`
- Cookie selector: `sadhana_release_channel=preview`

## Manual Production Changes

### 1. Update Docker Compose

Add a preview service in `~/docker/docker-compose.yml` (same image, same env, no host-published port):

```yaml
services:
  sadhana:
    image: japaschool/sadhana:${SADHANA_STABLE_TAG:-latest}
    # existing config...

  sadhana-preview:
    image: japaschool/sadhana:${SADHANA_PREVIEW_TAG:-latest}
    # mirror sadhana env/network settings
    # do not publish host ports
```

### 2. Update Reload Script API

Update `/home/sadhana/scripts/sadhana_reload.sh` to accept:

```bash
sadhana_reload.sh <channel> <tag>
```

Expected behavior:
- `channel=preview`: update only `sadhana-preview`
- `channel=stable`: update only `sadhana`
- no implicit stable promotion during preview deploys

Keep deployment logging with timestamp, channel, and tag.

### 3. Update Nginx Routing

Edit `~/docker/nginx.conf` to route by cookie.

Use two upstreams and a cookie map:

```nginx
upstream app_stable {
  server sadhana:8080;
}

upstream app_preview {
  server sadhana-preview:8080;
}

map $cookie_sadhana_release_channel $release_upstream {
  default app_stable;
  preview app_preview;
}
```

Then route requests through `$release_upstream`.

Keep existing caching behavior with one required adjustment:
- `index.html` and `service_worker.js` must stay `Cache-Control: no-cache, must-revalidate`

### 4. Fail Closed For Preview Traffic

If preview is unavailable, do not silently route preview users to stable.

Recommended behavior:
- default users: stable
- preview-cookie users: preview
- preview-cookie users when preview down: explicit `503` response

## GitHub Actions Expectations

This repository now assumes remote deploy command shape:

```bash
bash /home/sadhana/scripts/sadhana_reload.sh <channel> <tag>
```

Workflows:
- `.github/workflows/build_dockerhub.yml`
  - builds and pushes images
  - optional deploy controlled by `deploy_channel` input (`none|preview|stable`)
- `.github/workflows/run_latest.yml`
  - explicit tagged deploy with `deploy_channel` + `image_tag` inputs

## Release Flow

### Deploy Preview

1. Run `Build and Upload to Docker Hub` with `deploy_channel=preview`
2. Verify preview container is healthy
3. Enable tester cookie (`sadhana_release_channel=preview`)
4. Validate UI + API version metadata

### Promote Preview to Stable

1. Run `Deploy tagged image from Docker Hub`
2. Set `deploy_channel=stable`
3. Set `image_tag` to the validated preview tag (for example `git-abc1234`)

### Rollback Stable

1. Run `Deploy tagged image from Docker Hub`
2. Set `deploy_channel=stable`
3. Set `image_tag` to prior known-good tag

## Verification Checklist

### Server-side

```bash
cd ~/docker && docker compose ps
```

Expected:
- `sadhana` up
- `sadhana-preview` up
- `nginx` up

### Routing behavior

```bash
curl -s https://app.sadhana.pro/api/version
curl -s --cookie 'sadhana_release_channel=preview' https://app.sadhana.pro/api/version
```

Expected:
- stable request returns stable `git_sha` and `release_channel`
- cookie request returns preview `git_sha` and `release_channel`

### Browser behavior

1. Open Settings
2. Toggle `Preview Channel`
3. Confirm full reload occurs
4. Open Help page and verify `git_sha` + `release_channel`

## Migration Safety Rule

App startup migrations are now gated by `RUN_DB_MIGRATIONS`.

Default behavior should keep this unset for both stable and preview services.
Run migrations only as an explicit operational step when needed.
