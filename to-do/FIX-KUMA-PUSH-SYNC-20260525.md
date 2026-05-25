# kuma-pm2-push-sync: fetch failed (root cause + fix, 25/05/2026)

## Symptom

`/root/.pm2/logs/kuma-pm2-push-sync-error.log` was filling up with one
`fetch failed` line per monitor per loop, and the Kuma dashboard had every
`PM2 *` push monitor stuck in either:

- "Pending: No heartbeat in the time window", or
- "Failing: No heartbeat in the time window"

Direct `curl http://127.0.0.1:3011/api/push/<token>` returned `200 {"ok":true}`
in well under a second, so the endpoint itself was healthy.

## Diagnosis

Two separate problems were stacked on top of each other:

### 1. Real root cause: MariaDB row-lock pile-up in `news_apis`

`information_schema.innodb_trx` showed 8+ transactions stuck in `LOCK WAIT`
for over 5 minutes each, all from the webhook workers:

```
DELETE FROM webhook_message_cache
WHERE status = 'pending'
ORDER BY created_at ASC
LIMIT N
```

12 `webhook-worker-*` processes plus `enhanced-webhook-proxy` were all
running this DELETE concurrently against the same `status='pending'` rows
ordered by `created_at`. They all picked the same first N rows, only one
could hold the X-lock at a time, the rest queued. With ~60 active
`news_apis` queries on the box, MariaDB's worker threads and InnoDB
buffer pool were saturated, and **every other database on the same
instance, including `news_status`, slowed to a crawl**.

Sequential `curl` against `/api/push` measured 1.4 to 5.3 s per call
(should be < 100 ms). Kuma's handler at
`server/routers/api-router.js:47` does several SELECTs plus an INSERT
INTO heartbeat plus two cleanup DELETEs against `stat_minutely` and
`stat_hourly`; those go through the shared MariaDB instance and
inherited the I/O contention.

### 2. Why the helper amplified it

`modules/pm2-kuma-push-sync.js` had three design issues that turned
"slow Kuma" into "every monitor flapping":

1. **Sequential pushes**. The original `for (const monitor of monitors)`
   awaited each fetch before starting the next. With 33 push monitors
   and ~5 s per `/api/push` call, one full sync took ~165 s.
2. **Loop interval (60 s) shorter than one full sync**. `setInterval`
   fired every 60 s regardless of whether the previous loop was done,
   so 2-3 syncs piled up concurrently and each fed more pressure into
   `/api/push` and MariaDB.
3. **Swallowed `error.cause`**. Node 18+ wraps the actual socket error
   inside `error.cause`; the helper logged only `error.message`, which
   for `fetch()` is always the generic string `fetch failed`. There was
   no way to tell `ECONNREFUSED` apart from `ETIMEDOUT` apart from a
   real timeout in the logs, and that's exactly what hid the lock-wait
   storm for days.

## Fix

`modules/pm2-kuma-push-sync.js` rewritten with the same external
contract (same SQL query, same URL pattern) but four behavioural
changes:

| Change | Why |
| --- | --- |
| Bounded parallel pushes (`runWithConcurrency`, default `KUMA_PUSH_CONCURRENCY=10`) | 33 monitors finish in ~11-22 s instead of ~165 s; loop never stacks. |
| Per-fetch timeout via `AbortController` (default `KUMA_PUSH_FETCH_TIMEOUT_MS=15000`) | A single hung `/api/push` call cannot tie up a worker slot indefinitely. |
| Re-entrancy guard (`syncRunning` flag) | If a loop somehow runs longer than the interval, the next tick logs "still running, skipping" instead of stacking. |
| `describeFetchError(error)` surfaces `error.cause.code` / message | Logs now read `... [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:3011` instead of bare `fetch failed`. Failure log is rate-limited after 3 consecutive failing loops to avoid spam. |

`ecosystem.config.js` now declares both apps so env vars are reproducible
across reboots and pm2 dumps:

- `KUMA_PUSH_LOOP_MS=30000` (was implicit 60 s in code)
- `KUMA_PUSH_CONCURRENCY=10`
- `KUMA_PUSH_FETCH_TIMEOUT_MS=15000`
- `KUMA_PUSH_BASE_URL=http://127.0.0.1:3011/api/push`

Loop interval cut from 60 s to 30 s. The PM2 push monitors are
configured with `interval=60`, so a 30 s helper cadence keeps every
monitor at least one push fresh inside its overdue window even when
`/api/push` itself takes 5+ s (the news_apis lock-wait scenario).
Without that cushion, Kuma's internal "No heartbeat in the time window"
checker fires between pushes and monitors flap UP/Pending/UP.

All values come from env vars with defaults in code, so the helper
keeps working if `ecosystem.config.js` is overridden or unloaded.

## Verification

```
$ pm2 startOrReload ecosystem.config.js --update-env
$ pm2 env 41 | grep KUMA_PUSH
KUMA_PUSH_BASE_URL: http://127.0.0.1:3011/api/push
KUMA_PUSH_FETCH_TIMEOUT_MS: 15000
KUMA_PUSH_CONCURRENCY: 10
KUMA_PUSH_LOOP_MS: 30000

$ tail /root/.pm2/logs/kuma-pm2-push-sync-out.log
[pm2-kuma-push-sync] starting (loop=30000ms concurrency=10 fetch_timeout=15000ms)
[pm2-kuma-push-sync] ok 33/33 in 22224 ms
[pm2-kuma-push-sync] ok 33/33 in 15257 ms
[pm2-kuma-push-sync] ok 33/33 in 11224 ms
[pm2-kuma-push-sync] ok 33/33 in 13393 ms
[pm2-kuma-push-sync] ok 33/33 in 17192 ms
[pm2-kuma-push-sync] ok 33/33 in 20570 ms
[pm2-kuma-push-sync] ok 33/33 in 15595 ms
[pm2-kuma-push-sync] ok 33/33 in 22414 ms
```

Six consecutive loops, 33/33 successful each time. No new entries
in stderr.

Status of the PM2 push monitors after the fix (latest heartbeat per
monitor, `news_status.heartbeat`):

```
last_status   monitors
1 (UP)        30
0 (DOWN)      3   <-- nt-canary, nt-canary2, rabbitmq-connection-cleanup
                   are actually `stopped` in PM2; correctly reported.
2 (Pending)   0
```

Zero monitors are stuck on "No heartbeat in the time window".

## Out of scope but worth fixing separately

The `news_apis` lock-wait storm is the actual root cause of slow
`/api/push` and was already in flight before today's Kuma changes. The
right fix lives in the webhook workers, not in Kuma:

- The current `DELETE FROM webhook_message_cache WHERE status='pending' ORDER BY created_at ASC LIMIT N` pattern, run by 12+ workers in parallel, is a textbook lock pile-up. Workers should either:
  - Claim a batch with `UPDATE ... SET status='claimed', worker_id=? WHERE status='pending' ORDER BY created_at LIMIT N` first (single row-locking step), then process and `DELETE WHERE worker_id=?`, or
  - Use `FOR UPDATE SKIP LOCKED` (MariaDB 10.6+) to let workers grab
    distinct rows without contending on the same row locks.
- Either approach removes the LOCK WAIT chain entirely. Kuma's pushes
  will then complete in milliseconds again and the helper won't even
  need parallelism, but the new helper is the right shape regardless.

## Files changed

- `modules/pm2-kuma-push-sync.js` (rewritten)
- `ecosystem.config.js` (added `kuma-pm2-push-sync` app entry with env vars)
