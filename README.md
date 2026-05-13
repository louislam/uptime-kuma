# Uptime Worker

Uptime Worker is an independent Cloudflare-first uptime monitoring project. It
started as a fork of Uptime Kuma, but this repository is no longer presented as
a Docker-first upstream mirror. The goal of this fork is to keep the familiar
monitoring and status-page experience while moving the runtime to Cloudflare.

The current target platform is Cloudflare Workers with static assets, D1, R2,
Queues, Cron Triggers, and a containerized monitor runner.

## Project Status

This fork is under active migration toward a Cloudflare-native architecture.
The Vue dashboard and much of the monitoring model still come from the original
Uptime Kuma codebase, but the deployment surface in this repository is built
around `wrangler.jsonc` and the `cloudflare/` runtime.

Use this repository when you want:

- A monitoring app designed to deploy on Cloudflare.
- A Worker-hosted web UI with SPA asset serving.
- D1-backed monitor, heartbeat, and network profile state.
- Scheduled monitor execution through Cloudflare Cron Triggers and Queues.
- A Cloudflare Container runner for checks that need Node.js, network tooling,
  or private-network routing.
- Optional Twingate-backed network profiles for private endpoint checks.

Use upstream Uptime Kuma if you want the established Docker/PM2 self-hosted
server distribution without the Cloudflare migration layer.

## Architecture

The Cloudflare runtime is split into three main pieces:

- `cloudflare/worker/index.mjs` is the Worker entry point. It serves `/api/*`
  through Worker code, serves the built Vue app from Cloudflare assets, runs the
  scheduled enqueue job, and consumes monitor-check queue messages.
- `cloudflare/worker/api.mjs` contains the Worker API for network profiles,
  monitor route assignment, immediate checks, queued checks, heartbeat writes,
  and runner status.
- `cloudflare/runner/` contains the containerized check runner. The Worker calls
  this runner through the `MonitorRunner` Durable Object container binding.

Cloudflare resources are declared in `wrangler.jsonc`:

- `ASSETS` serves `dist/` as a single-page application.
- `DB` binds the `uptimeworker` D1 database.
- `ARTIFACTS` binds the `uptimeworker-artifacts` R2 bucket.
- `MONITOR_QUEUE` binds the `uptimeworker-monitor-checks` queue.
- `RUNNER` binds the `MonitorRunner` container Durable Object.
- A cron trigger runs once per minute and enqueues active monitors.

## Repository Layout

```text
cloudflare/
  migrations/          D1 schema for monitors, heartbeats, and network profiles
  runner/              Container runner for monitor checks and Twingate proxying
  worker/              Cloudflare Worker entry point and API handlers
config/                Vite and Playwright configuration
db/                    Legacy and current database migration files
public/                Static app assets and PWA metadata
server/                Original Node server and monitor-provider code
src/                   Vue dashboard, status pages, and shared frontend modules
test/                  Backend, Cloudflare API, and browser tests
wrangler.jsonc         Cloudflare deployment configuration
```

## Requirements

- Node.js 20.4 or newer.
- npm.
- A Cloudflare account with Workers, D1, R2, Queues, Cron Triggers, Durable
  Objects, and Containers available for the target environment.
- Wrangler authentication for the account that owns the configured resources.

## Local Development

Install dependencies:

```bash
npm ci
```

Run the inherited local development stack:

```bash
npm run dev
```

Build the Vue application:

```bash
npm run build
```

The Cloudflare Worker expects the built frontend in `dist/`, matching the
`assets.directory` setting in `wrangler.jsonc`.

## Cloudflare Development

Build the frontend before running or deploying the Worker:

```bash
npm run build
```

Apply the D1 migration locally when working against a local Wrangler runtime:

```bash
npx wrangler d1 migrations apply uptimeworker --local
```

Start a local Worker session:

```bash
npx wrangler dev
```

Deploy to Cloudflare:

```bash
npx wrangler deploy
```

The Worker dashboard supports a local username/password login in
Settings > Security. On a fresh deployment, use the existing Cloudflare Access
or admin-token path to open Settings > Security and create the local admin
login. After a local login exists, browser dashboard access uses that
username/password session instead of the Cloudflare Access identity.

Set an admin API token before exposing the Worker deployment if you also need
scripted access or a local fallback. All monitor, settings, network-profile,
check-now, and Twingate status endpoints fail closed unless the request has a
valid local dashboard session, this bearer token, or a valid Cloudflare Access
JWT before local auth has been configured:

```bash
openssl rand -base64 32 | npx wrangler secret put ADMIN_API_TOKEN
```

The Worker dashboard sends its local session as a bearer token. The fallback
admin token is still accepted when it is stored in browser local storage or
session storage under `uptimeWorkerAdminToken` or `cloudflareWorkerApiToken`,
but local username/password login is preferred for browser use. Public
status-page endpoints do not require admin authentication.

If your deployment account or resource names differ from this repository's
defaults, update `wrangler.jsonc` before deploying. Keep the binding names stable
unless the Worker code is updated at the same time.

## Cloudflare Resources

The checked-in Wrangler configuration currently targets these resource names:

| Binding | Cloudflare resource |
| --- | --- |
| `DB` | D1 database `uptimeworker` |
| `ARTIFACTS` | R2 bucket `uptimeworker-artifacts` |
| `MONITOR_QUEUE` | Queue `uptimeworker-monitor-checks` |
| `RUNNER` | Container Durable Object class `MonitorRunner` |
| `ASSETS` | Built Vue assets from `./dist/` |

The first D1 migration creates:

- `network_profiles`
- `monitors`
- `heartbeats`

It also seeds a `twingate` network profile for private routing.

## Twingate Private Routing

The monitor runner can start `twingated` inside the Cloudflare Container when a
service key is provided. The recommended setup is to store the original
downloaded Twingate service key JSON as a Worker secret:

```bash
jq -c . service_key.json | npx wrangler secret put TWINGATE_SERVICE_KEY_JSON
```

Using `TWINGATE_SERVICE_KEY_JSON` avoids newline and escaping mistakes in the
PEM private key. If you previously configured a malformed private-key secret,
delete stale alternatives so the deployment cannot fall back to them later:

```bash
npx wrangler secret delete TWINGATE_PRIVATE_KEY
npx wrangler secret delete TWINGATE_PRIVATE_KEY_B64
npx wrangler secret delete TWINGATE_SERVICE_KEY_B64
```

If you want to keep the discrete metadata fields in `wrangler.jsonc`, the
alternative is to set only the PEM private key value:

```bash
jq -r '.private_key' service_key.json | npx wrangler secret put TWINGATE_PRIVATE_KEY
```

Do not paste the full service key JSON into `TWINGATE_PRIVATE_KEY`, and do not
base64-encode the full JSON into `TWINGATE_PRIVATE_KEY_B64`. `TWINGATE_PRIVATE_KEY`
expects only the PEM `private_key` value. `TWINGATE_PRIVATE_KEY_B64` expects only
the base64-encoded PEM. The legacy `TWINGATE_SERVICE_KEY_B64` secret is still
supported and should contain the full base64-encoded Twingate service key JSON.
When both forms are present, `TWINGATE_SERVICE_KEY_JSON` takes precedence.

The Cloudflare container runner manages the local Twingate network mode and
userspace HTTP proxy address internally. Do not configure a proxy URL for
Twingate; only the service account fields and private-key secret are
operator-provided.
Cloudflare-hosted Twingate checks support private HTTP, keyword, JSON query,
TCP port, and WebSocket reachability checks through the userspace proxy.
Twingate ICMP ping checks run through the Twingate TUN route; the default
container setting is `TWINGATE_TUN=on`.

## Testing

Run the Cloudflare-focused backend tests:

```bash
node --test --test-reporter=spec test/backend-test/cloudflare/test-worker-api.mjs
```

Run the broader backend test entrypoint:

```bash
npm run test-backend
```

Run the full project test suite when making broad application changes:

```bash
npm test
```

Some inherited tests may require local services, browser dependencies, or
container support. If a check cannot run in your environment, record that
explicitly in the change or pull request.

## Deployment Notes

- Build `dist/` before deployment; the Worker serves it through the `ASSETS`
  binding.
- Apply D1 migrations before relying on monitor or heartbeat state.
- Keep `run_worker_first` for `/api/*` so API requests are handled by the Worker
  instead of the SPA fallback.
- Queue consumers and the scheduled trigger are part of the production monitor
  execution path.
- The runner container is intentionally separate from the Worker because checks
  may need Node.js libraries, network clients, and private routing helpers that
  do not belong directly in the Worker isolate.

## Relationship to Uptime Kuma

Uptime Worker is based on Uptime Kuma and retains MIT-licensed code from that
project. The fork is independent: documentation, deployment defaults, and future
development in this repository are oriented around Cloudflare rather than the
upstream Docker-first distribution.

For the upstream project, see:

<https://github.com/louislam/uptime-kuma>

## License

This project is distributed under the MIT license. See `LICENSE` for the full
license text.
