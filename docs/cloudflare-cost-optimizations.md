# Cloudflare Cost Optimizations

Follow-up to [cloudflare-d1-write-reduction.md](./cloudflare-d1-write-reduction.md),
focused on hot-path D1 reads, steady-state writes, and avoidable client polling.

## Worker (D1 reads/writes)

- **Deploy-pause settings read removed from the steady-state check path.**
  `getDeployMonitorPauseState` previously issued one `app_settings` read per
  queued monitor check, per queue batch, and per cron tick. Once a Worker
  version is observed unpaused it can never re-enter its pause window, so the
  verdict is now cached per isolate. Saves roughly `monitors + 2` reads per
  minute in steady state.
- **Status page heartbeat endpoint batched.** `/api/status-page/heartbeat/:slug`
  previously ran ~4 queries per selected monitor per poll (monitor row, count,
  heartbeat page, metric-bucket uptime) from anonymous visitors. It now hydrates
  every selected leaf monitor with two batched queries
  (`listRecentHeartbeatsByMonitorId` + `listRuntimeSummariesByMonitorId`) and
  prefers the precomputed `uptime_24` from the runtime summary cache.
- **Twingate alert state writes deduplicated.** The 5-minute health-alert cron
  rewrote its state setting on every run even when nothing changed (288
  writes/day when enabled). It now writes only when a decision-relevant field
  changes.
- **UI settings saves diffed and batched.** `setUiSettings` wrote ~33 individual
  upserts per save; it now writes only changed keys in a single `DB.batch()`
  round trip, and refuses to overwrite sensitive keys (auth user, session
  secret, TOTP, deploy/alert state).

## Frontend (request volume against the Worker)

- Status pages no longer poll while the tab is hidden, refresh immediately on
  return to visibility, no longer double-poll due to a duplicated refresh-loop
  setup, and clear their intervals on unmount.
- The Details-page ping chart skips its 60-second background refresh while the
  tab is hidden.
- The dashboard "important events" page-size recalculation is debounced and
  clamped, so window-resize bursts trigger at most one bounded refetch instead
  of a train of ever-larger queries.
