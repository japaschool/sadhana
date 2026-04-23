# Cookie-Routed Parallel Release Design

## Summary

Deploy two versions of the application at the same time behind the existing `app.sadhana.pro` Nginx entrypoint:

- `stable`: the version normal users receive
- `preview`: the candidate version available only to users with an explicit preview cookie

Nginx selects the upstream per request using a cookie such as `sadhana_release_channel=preview`. The Actix server and the WASM frontend remain bundled together in one Docker image per release, so each container continues to serve a self-consistent backend and frontend pair.

This design keeps a single public hostname, allows selected testers to opt into the new version, and makes rollback immediate by removing or ignoring the preview cookie.

## Goals

- Run the current and candidate release at the same time on `app.sadhana.pro`
- Allow selected users to access the candidate release without a separate public endpoint
- Keep the backend and frontend versions aligned per request
- Make it easy to promote the preview version to become the stable version
- Make rollback operationally simple
- Avoid requiring Yew route changes such as a `/preview` prefix

## Non-Goals

- Isolating preview traffic in a separate database or environment
- Supporting arbitrary percentages of traffic automatically
- Running schema-breaking releases where the old version cannot operate against the new schema
- Solving long-term multi-version compatibility for more than two adjacent releases

## Constraints From Current App

- The backend is Actix Web and serves the built frontend from the same release artifact
- Each release is built into one Docker image
- The app currently registers a service worker at `/service_worker.js`
- The server currently runs Diesel migrations on startup
- Both preview and stable will share the same database in this design

These constraints mean the routing layer should switch entire containers, not split backend and frontend independently.

## Recommended Architecture

### Components

- `nginx`: public entrypoint on `app.sadhana.pro`
- `app_stable`: current production container
- `app_preview`: candidate container
- Shared PostgreSQL database

### Request Routing

Nginx routes every request based on a release-channel cookie:

- no cookie: route to `app_stable`
- `sadhana_release_channel=preview`: route to `app_preview`

This applies to:

- HTML document requests
- static assets
- `/service_worker.js`
- API requests

That requirement is important. A preview user must consistently hit the preview container for the full request graph, otherwise HTML, JS, service worker, and API versions can drift.

### Release Model

Each deployed image remains unchanged:

- one Actix server binary
- one compiled frontend build
- one `dist/` tree

Operationally, a release becomes:

1. Build new image
2. Start it as `app_preview`
3. Grant testers the preview cookie
4. Validate behavior live
5. Promote the image by swapping `app_stable` to the new release
6. Retire the old stable container

## Nginx Design

### Routing Rule

Use an Nginx `map` on the preview cookie to select the upstream.

Illustrative shape:

```nginx
upstream app_stable {
    server 127.0.0.1:9001;
}

upstream app_preview {
    server 127.0.0.1:9002;
}

map $cookie_sadhana_release_channel $release_upstream {
    default app_stable;
    preview app_preview;
}

server {
    server_name app.sadhana.pro;

    location / {
        proxy_pass http://$release_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Release-Channel $cookie_sadhana_release_channel;
    }
}
```

### Cookie Management

The frontend settings page may toggle the cookie using client-side code. Required properties:

- name: `sadhana_release_channel`
- values: `stable` or `preview`
- path: `/`
- secure: enabled
- same-site: `Lax` is sufficient
- expiry: explicit, for example 7 or 30 days

Behavior:

- switching to preview sets `preview`, then forces a full page reload
- switching back sets `stable` or deletes the cookie, then forces a full page reload

A hard reload after the toggle is required so the browser re-fetches HTML, JS, and service worker from the newly selected upstream.

### Operational Safety

If `app_preview` is unavailable, Nginx should fail closed for preview users rather than silently sending them to stable. Silent fallback makes debugging much harder because a tester may believe they are on preview while actually exercising stable.

Recommended behavior:

- no preview cookie: always stable
- preview cookie + preview upstream healthy: preview
- preview cookie + preview upstream unhealthy: return a clear 503 page saying preview is temporarily unavailable

## Frontend And Service Worker Design

### Why This Needs Special Handling

The app uses a root-scoped service worker at `/service_worker.js`. With cookie-based split routing on a single hostname, the same browser can switch between stable and preview on the same origin and scope. If caching is not version-aware, old assets and old cached API responses can survive the switch and produce mixed-version behavior.

### Required Rules

1. Asset URLs must be content-hashed or otherwise release-unique
2. HTML must not be cached aggressively
3. Service worker caches must be namespaced by release SHA
4. The settings toggle must force a full reload after changing the cookie
5. The UI should expose the active release version clearly

### Service Worker Versioning

The service worker already embeds `GIT_SHA`. Use that as the cache namespace key for all static and API caches.

Design requirements:

- cache names include the full or short release SHA
- activation removes caches from older SHAs
- update checks compare the server-reported version with the active service worker version
- toggling preview causes the browser to download the service worker served by the selected container

This does not allow stable and preview to be active in the same browser at once. That is acceptable. The user is explicitly opting one browser session into one channel at a time.

### Cache-Control Policy

Recommended response policy:

- `index.html`: `Cache-Control: no-cache, must-revalidate`
- `service_worker.js`: `Cache-Control: no-cache, must-revalidate`
- hashed JS/CSS/WASM assets: `Cache-Control: public, max-age=31536000, immutable`
- API responses: keep current application-level behavior unless a specific endpoint proves problematic

The important part is that HTML and the service worker must revalidate so a cookie-driven channel switch takes effect immediately.

## Backend Design

### No App-Level Traffic Splitting

Actix should not decide stable versus preview. That decision belongs in Nginx. The backend remains a normal single-version server process.

### Version Visibility

Keep the existing version endpoint and surface the active release SHA in settings or another clearly visible place for testers. That gives immediate confirmation that the cookie actually selected the intended version.

### Migration Policy

This is the main engineering constraint for same-database dual running.

Because stable and preview will run simultaneously against one database, schema changes must be backward compatible for at least one release window. Specifically:

- additive migrations are acceptable
- destructive or semantic-breaking migrations are not acceptable while both versions are live
- code must tolerate both the pre-migration and post-migration state if rollout spans both versions

### Startup Migration Change

The current server startup runs pending Diesel migrations automatically. That is risky in a parallel-release model because:

- both containers may attempt migration work
- a preview rollout could mutate schema before the release is promoted
- a failed preview experiment could still have changed production schema

Recommended change:

- remove automatic migrations from app startup
- run migrations as an explicit operational step before promotion, or via a dedicated one-shot migrator job

That makes schema changes intentional and auditable.

## Release Workflow

### Deploy Preview

1. Build candidate image
2. Start `app_preview` on its own local port
3. Verify `/version` and health endpoints directly
4. Enable preview cookie for internal testers
5. Test live on production infrastructure

### Promote Preview

1. Confirm preview is healthy and accepted
2. If needed, run the planned migration step
3. Replace `app_stable` with the preview image
4. Remove preview cookie from testers or leave preview pointed at the same image temporarily
5. Shut down the old stable container after confidence window

### Roll Back

If preview fails:

- remove the preview cookie from testers, or
- point the preview upstream back to the stable image, or
- stop `app_preview` and return the explicit preview-unavailable page

If the promoted release fails after switch:

- restart old stable image as the stable upstream
- only possible safely if any schema changes were backward compatible

## Observability

Add release-channel visibility to logs and diagnostics.

Recommended additions:

- Nginx access logs include upstream name and release cookie value
- backend logs include release SHA and, if forwarded, release channel header
- UI settings/help page shows release SHA and channel

This is required for debugging reports like "works on preview, fails on stable".

## Risks And Mitigations

### Risk: Mixed Asset Versions

Cause:
- browser caches old HTML, JS, or service worker across channel switch

Mitigation:
- no-cache on HTML and service worker
- release-unique asset names
- service worker cache namespaces keyed by release SHA
- forced full reload after toggle

### Risk: Hidden Fallback To Stable

Cause:
- preview route silently falls back when preview container is down

Mitigation:
- fail closed with explicit 503 for preview users

### Risk: Schema Incompatibility

Cause:
- preview release depends on schema changes that stable cannot tolerate

Mitigation:
- enforce backward-compatible migrations
- remove startup auto-migration
- migrate only as an explicit release step

### Risk: User Confusion About Which Version They Are Running

Cause:
- both channels use the same URL

Mitigation:
- visible version/channel indicator in settings or header for preview users

## Implementation Outline

1. Add Nginx upstreams and cookie-based `map`
2. Add health check and operational scripts for two app containers
3. Add settings toggle for release-channel cookie
4. Ensure toggle performs a full reload
5. Confirm service worker cache keys are release-specific
6. Confirm static asset URLs are release-specific and HTML revalidates
7. Remove automatic DB migration from server startup
8. Add release/channel visibility in UI and logs
9. Update GitHub Actions workflows and deployment scripts to support building, deploying, promoting, and rolling back separate `preview` and `stable` app containers
10. Document operational deploy, promote, and rollback steps

## Recommendation

Proceed with cookie-based parallel release routing at Nginx, but treat the following as mandatory parts of the design rather than optional polish:

- release-aware service worker and asset caching
- explicit no-cache policy for HTML and service worker
- no silent preview fallback
- explicit migration workflow outside server startup

Without those pieces, approach 1 is likely to produce mixed-version behavior that will be difficult to diagnose.
