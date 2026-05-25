# Performance and dup-key fixes: 25/05/2026 (evening, post merge)

Two follow-ups after the WebSocket fix earlier in the evening
(`to-do/FIX-SOCKETIO-WEBSOCKET-20260525.md`):

1. **Connection pool was silently capped at 10.** `afterLogin` for an
   admin login took 30-75 seconds because knex was throttled.
2. **`stat_minutely` / `stat_hourly` duplicate-key flood.** Two parallel
   `update()` calls for the same monitor in the same minute were
   colliding on `(monitor_id, timestamp)`.

## 1. DB connection pool: env var was being ignored

### Symptom

`UPTIME_KUMA_DB_POOL_MAX_CONNECTIONS=50` set in
`ecosystem.config.js`, but live MariaDB processlist still pinned at
exactly 11 connections (10 + the persistent `mysql.createConnection`
in `database.js`). Even under heavy parallel load (30 simultaneous
HTTP hits), connections never grew above 11.

### Root cause

`server/database.js`, after building the mariadb config (with
`pool: mariadbPoolConfig` carrying `min`, `max`, `idleTimeoutMillis`
from the env var), runs:

```javascript
if (dbConfig.type.endsWith("mariadb")) {
    config.pool = {
        afterCreate(conn, done) {
            conn.query("SET CHARACTER SET utf8mb4;", (err) => done(err, conn));
        },
    };
}
```

The reassignment **clobbers** the pool config; only `afterCreate`
survives. Knex falls back to its default `min: 2, max: 10`. The env
var has no effect on production installs.

### Fix

Spread the existing pool config so `afterCreate` is added without
losing `min`/`max`/`idleTimeoutMillis`:

```javascript
if (dbConfig.type.endsWith("mariadb")) {
    config.pool = {
        ...config.pool,
        afterCreate(conn, done) {
            conn.query("SET CHARACTER SET utf8mb4;", (err) => done(err, conn));
        },
    };
}
```

Plus set the env var in `ecosystem.config.js`:

```javascript
env: {
    UPTIME_KUMA_PORT: "3011",
    UPTIME_KUMA_DISABLE_FRAME_SAMEORIGIN: "1",
    UPTIME_KUMA_DB_POOL_MAX_CONNECTIONS: "50",
},
```

### Verification

Burst of 30 parallel `/api/status-page/heartbeat` requests:

| Metric | Before | After |
|---|---|---|
| Total connections to news_status DB | 11 (pinned) | 51 (50 + 1) |
| Active queries during burst | 11 max | 49 measured |

Login `Username from JWT -> Successfully logged in` round trip on
the same dataset (49 monitors, 5 status pages) drops from 41-75 s
to 1-3 s.

This is an upstream bug; will send a PR.

## 2. `stat_minutely` race condition: duplicate-key flood

### Symptom

Error log was filling up with thousands of:

```
Error: insert into `stat_minutely` (...) values (...)
  - Duplicate entry '23-1779732720'
    for key 'stat_minutely_monitor_id_timestamp_unique'
```

24,544 occurrences across the file before the fix. Same race on
`stat_hourly` for some monitors. Most-collided monitor IDs were 41
(24x in last 1000 lines) and 26 (22x in same window), both PM2
push monitors.

### Root cause

`server/uptime-calculator.js` `update()` lines 315 / 335 / 354 each
do `await R.store(bean)` after a check-then-act pattern in
`get*StatBean()`:

```javascript
async getMinutelyStatBean(timestamp) {
    if (this.lastMinutelyStatBean && this.lastMinutelyStatBean.timestamp === timestamp) {
        return this.lastMinutelyStatBean;
    }
    let bean = await R.findOne("stat_minutely", " monitor_id = ? AND timestamp = ?", [...]);
    if (!bean) {
        bean = R.dispense("stat_minutely");  // <-- no id, INSERT on store
        bean.monitor_id = this.monitorID;
        bean.timestamp = timestamp;
    }
    this.lastMinutelyStatBean = bean;
    return this.lastMinutelyStatBean;
}
```

When two `update()` calls land for the same monitor in the same
minute (PM2 push monitors are hit by both the external push HTTP
endpoint via kuma-pm2-push-sync **and** Kuma's internal scheduler),
both `findOne` return null in the race window, both dispense fresh
beans, both `R.store` issues an INSERT. Second INSERT loses to the
unique key.

### Fix

New helper `safeStoreStatBean(table, bean)` in
`server/uptime-calculator.js`. On `R.store` failure, if it's a
duplicate-key error (MariaDB `ER_DUP_ENTRY`, `Duplicate entry`,
SQLite `SQLITE_CONSTRAINT`, `UNIQUE constraint failed`), it
re-fetches the now-existing row, copies the caller's aggregate
values onto it, and stores. Returns the persisted bean so the
caller can refresh its `lastDailyStatBean` / `lastHourlyStatBean` /
`lastMinutelyStatBean` cache to a bean with `id` set (otherwise the
stale dispensed bean would re-INSERT and dup again on the next
heartbeat).

Aggregate values (`up`, `down`, `ping`, `pingMin`, `pingMax`,
`extras`) are cumulative: by the time the second `update()`
resolves, `minutelyUptimeDataList` already includes both
heartbeats, so overwriting is correct.

Cross-DB compatible (SQLite + MariaDB).

### Verification

Race stress test: 30 parallel `curl` pushes to the same monitor's
push token in the same minute.

| Metric | Before fix | After fix |
|---|---|---|
| New `Duplicate entry` errors during 30-parallel-push burst | 5-15 | 0 |
| stat_minutely rows for that minute | 1 winning row + N rejected attempts | 1 row, correct aggregate (`up=31`) |

3-minute observation window after deploy: 0 new dup-key errors.
Pre-fix it was several per minute.

## Files changed

- `server/database.js` (in repo, committed)
- `server/uptime-calculator.js` (in repo, committed; new
  `safeStoreStatBean` helper + 3 wired call sites)
- `ecosystem.config.js` (in repo, committed)
- `to-do/FIX-PERF-DUPKEY-20260525.md` (this file, committed)

## Out-of-scope but observed

`kuma-pm2-push-sync` (the helper at `modules/pm2-kuma-push-sync.js`)
is currently logging `fetch failed` for every monitor. PM2 push
monitors all show "no heartbeat in the time window". The pool fix
and dup-key fix are independent of this; they were verified by
hitting the push endpoint directly. Investigating the helper's
fetch failure can be a separate follow-up.
