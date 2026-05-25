# Login round trip cut from ~50 s cold / ~20 s warm to ~3 s warm (25/05/2026)

## Symptom

After the WebSocket and connection-pool fixes from earlier today, login still
felt sluggish. Server logs paired `Login by token` against
`Successfully logged in user Admin` and showed:

| State | Round trip |
| --- | --- |
| Cold (post pm2 reload, pre-warm in flight) | 41 to 50 s |
| Warm (no other DB load) | 18 to 26 s |

The Vue client cannot render `<router-view>` until that callback resolves, so
`/manage-status-page` and `/dashboard` looked frozen for the entire window.

## Diagnosis

Temporary instrumentation in `afterLogin` (since reverted) showed:

```
afterLogin timing: monitorList=18676ms smallLists=1308ms statusPageList=991ms total=20975ms
```

The bottleneck was `getMonitorJSONList` -> `Monitor.preparePreloadData`, which
issued five unbounded `Promise.all` fan-outs back to back:

| Fan-out | Per-monitor work |
| --- | --- |
| `isUnderMaintenance` | one SELECT, then recurses via `getParent` |
| `getAllChildrenIDs` | recurses via `getChildren` (one SELECT per hop) |
| `isActive` | calls `isParentActive` (recursive `getParent`) |
| `isParentActive` | recursive `getParent` |
| `getAllPath` | recursive `getParent` |

For 49 monitors with shallow trees this still produced 250 to 500 SELECTs per
login, all queued behind the connection pool. With Knex's default pool of 10 it
never finished in less than ~50 s; even with pool 50 it stayed at ~17 s because
the 5 fan-outs ran sequentially and the recursive walks serialized.

A second, independent issue: the heavy `sendHeartbeatList` and
`Monitor.sendStats` fan-out (~150 more queries) was awaited as part of
`afterLogin` even when the user was navigating to `/manage-status-page` or
`/settings`, where that data is never displayed.

## Fix

All changes are server-side and require no client work; the Vue client already
populates reactively as Socket.IO events arrive.

### 1. Replace recursive parent walks with one batched SELECT

`server/model/monitor.js` -> `Monitor.preparePreloadData`:

- One `SELECT id, parent, active, name FROM monitor` builds an in-memory
  parent map and a parent -> children map.
- One `SELECT monitor_id, maintenance_id FROM monitor_maintenance WHERE
  monitor_id IN (...)` resolves maintenance lookups against the cached
  `UptimeKumaServer.maintenanceList`.
- `getAllPath`, `getAllChildrenIDs`, `isActive`, `isParentActive` and the
  parent inheritance for maintenance now traverse the in-memory maps. Zero
  recursive DB hops.

This collapses ~250 SELECTs into 4 batched SELECTs and drops `monitorList`
preload from ~17 s to ~50 ms.

### 2. Defer per-monitor heartbeat and stats to background

`server/server.js` -> `afterLogin`:

- The per-monitor `Promise.all` over `sendHeartbeatList` and
  `Monitor.sendStats` is no longer awaited. It runs in a fire-and-forget
  helper `sendPerMonitorDataInBackground`.
- That helper streams the work in chunks of 10, with per-promise `.catch`
  handlers so a single bad monitor cannot abort the rest.
- It bails early via `socket.disconnected` if the user closes the tab mid
  stream, so we don't keep doing DB work for nobody.

### 3. Pre-warm `UptimeCalculator` at boot

`server/server.js` adds `preWarmUptimeCalculators` and runs it in parallel
with `startMonitors` (both are idempotent and share the pool). It walks the
49 active monitors in chunks of 5, calling
`UptimeCalculator.getUptimeCalculator(id)` so the first admin login post
restart does not pay the cold-init cost (3 stat_* SELECTs per monitor on
first call).

### 4. Bump the connection pool to 80

`ecosystem.config.js`:

```
UPTIME_KUMA_DB_POOL_MAX_CONNECTIONS: "80"
```

Peak concurrency at login is now roughly 5 fan-outs * 8 chunk size = ~40 +
other afterLogin work. 80 leaves headroom while staying under MariaDB
`max_connections=300` and Kuma's own 100 ceiling (`server/database.js:280`).

## Verification

- Built and reloaded with `pm2 reload status-uptime-kuma --update-env`.
- Boot log: `Pre-warming UptimeCalculator for 49 active monitors` ->
  `UptimeCalculator pre-warm done: 49/49 in 56558 ms` (ran in parallel with
  startMonitors, did not block listen).
- `Test/measure-login-by-token.mjs` (forges a JWT against the live DB
  jwtSecret + admin password hash) measured 6 sequential warm logins:

  ```
  run 2: server work = 3379 ms
  run 3: server work = 4879 ms
  run 4: server work = 1998 ms
  run 5: server work = 3056 ms
  run 6: server work = 3720 ms
  ```

  Median ~3.4 s, min ~2 s. Compared to ~50 s cold / ~20 s warm before, that
  is a 6x to 25x speedup on the user-visible critical path.
- `https://status.newstargeted.com/manage-status-page` and `/dashboard`
  return 200 with sub-second TTFB on the SPA shell.
- No new errors in `status-uptime-kuma-out.log` or
  `status-uptime-kuma-error.log` after the change.

## Files changed

- `server/server.js`
- `server/model/monitor.js`
- `ecosystem.config.js`
- `Test/measure-login-by-token.mjs` (new test harness; reads `KUMA_JWT_SECRET`
  and `KUMA_PWHASH` from env, no hardcoded secrets)

## Follow-ups left intentionally

- The `kuma-pm2-push-sync` helper is still showing `fetch failed` errors in
  pm2 logs; that is a *separate* issue (network or token related) and was
  not touched here.
- Persisting `UptimeCalculator` state across restarts (rather than rebuilding
  from stat_* tables) would let cold starts skip the pre-warm entirely. Not
  critical now that pre-warm runs in parallel with `startMonitors`.
