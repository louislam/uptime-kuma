# Uptime Panda — Architecture Review & Implementation Roadmap

_Prepared by multi-agent review (architect + bug hunter), 2026-05-06_

---

## Executive Summary

The fork has made substantial architectural improvements over upstream: the ORM migration to Objection.js + Knex removes the RedBean-node hard dependency on SQLite, the dialect abstraction cleanly isolates DB-specific behaviour, and the snake_case migration eliminates the double-memory problem. The following gaps remain and are ordered by impact.

---

## Critical Issues

### [C-1] API Key Authorization Bypass

**File:** `server/socket-handlers/api-key-socket-handler.js:102,127`  
**Severity:** critical  
**Reproducible on:** all

`disableAPIKey` and `enableAPIKey` filter only on `id`, not `user_id`. Any authenticated user can disable or enable any other user's API key by guessing the numeric ID.

```js
// Vulnerable (line 102)
await getKnex()("api_key").where("id", keyID).update({ active: false });

// Correct pattern already used in deleteAPIKey (line 76)
await getKnex()("api_key").where({ id: keyID, user_id: socket.userID }).delete();
```

**Fix:** Add `user_id: socket.userID` to both `where()` clauses.

---

### [C-2] Missing Transactions on Multi-Table Writes

**File:** `server/server.js:771-778`, `server/model/monitor.js` (group delete)  
**Severity:** critical  
**Reproducible on:** all

Monitor creation inserts the monitor row, then calls `updateMonitorNotification` and `startMonitor` in separate statements. A failure in either leaves the database partially written. Same pattern exists in group deletion and maintenance creation.

**Fix:** Wrap sequences that touch >1 table in `getKnex().transaction(trx => ...)`.  
Minimum scope: monitor create/edit/delete, maintenance create/delete, group delete.

---

## High Priority

### [H-1] server.js Monolith (1 994 lines, 39 inline handlers)

**File:** `server/server.js`  
**Severity:** high

Socket handlers for monitors, authentication, backup/restore, DNS, cloudflared, and others are still inline in server.js alongside handler registration, startup logic, and database orchestration. This makes the file untestable in isolation and impractical to review.

**Recommendation:**
1. Extract remaining inline `socket.on()` blocks into `server/socket-handlers/monitor-socket-handler.js`, `auth-socket-handler.js`, etc.
2. Replace the manual registration block (lines 1699–1708) with auto-discovery:

```js
const handlersDir = path.join(__dirname, "socket-handlers");
for (const file of fs.readdirSync(handlersDir).filter(f => f.endsWith(".js"))) {
    require(path.join(handlersDir, file))(socket);
}
```

---

### [H-2] N+1 Queries for Monitor Hierarchy

**File:** `server/model/monitor.js:1861-1871`, `1972-1987`  
**Severity:** high

`getAllChildrenIDs()` recursively queries per monitor level. `preparePreloadData()` calls it once per monitor via `Promise.all()`, making the total query count `O(n × depth)`. For 100 monitors with 3 levels this is 300+ queries at startup and on each heartbeat push.

**Fix:** Replace recursive `getAllChildrenIDs()` with a single recursive CTE:

```sql
-- PostgreSQL / MariaDB 8+
WITH RECURSIVE tree AS (
  SELECT id, parent FROM monitor WHERE parent IS NULL
  UNION ALL
  SELECT m.id, m.parent FROM monitor m JOIN tree ON m.parent = tree.id
)
SELECT * FROM tree;
```

For SQLite (no recursive CTE until 3.35), load the full adjacency list in one `SELECT id, parent FROM monitor` and traverse in JS.

---

### [H-3] Blocking Database Calls Inside the Heartbeat Loop

**File:** `server/model/monitor.js:430-1158` (the `beat()` closure inside `start()`)  
**Severity:** high

`beat()` fetches proxy config, Docker host, TLS info, and maintenance status on every tick. These are mostly static and should be cached at startup / on write.

**Recommendation:**
1. Pre-fetch static config (proxy, Docker host) once when the monitor starts; re-fetch only on `editMonitor`.
2. Cache `isUnderMaintenance` in memory with invalidation on maintenance socket events.
3. Extract `beat()` into a named, exportable function so it can be unit-tested without a running server.

---

### [H-4] Maintenance Status Check on Every Beat

**File:** `server/model/monitor.js:474`  
**Severity:** high

`Monitor.isUnderMaintenance(this.id)` issues a DB query on every heartbeat. At 1 000 monitors × 60 s interval this is 1 000 extra queries/minute.

**Fix:**

```js
// In UptimeKumaServer or a MaintenanceCache singleton
class MaintenanceCache {
    constructor() { this._active = new Set(); }
    markActive(monitorId) { this._active.add(monitorId); }
    markInactive(monitorId) { this._active.delete(monitorId); }
    isActive(monitorId) { return this._active.has(monitorId); }
}
```

Populate on startup, update via the maintenance socket handler's create/update/delete events.

---

### [H-5] Unhandled Promise Rejections in Auth

**File:** `server/auth.js:81-91, 106-123`  
**Severity:** high  
**Reproducible on:** all

`verifyAPIKey()` and `exports.login()` are awaited inside `.then()` chains without `.catch()`. A rejection results in an unhandled promise warning (Node 18) or process exit (Node 21+ default).

**Fix:** Convert to `async/await` with try-catch:

```js
async function apiAuthorizer(username, password, callback) {
    try {
        const pass = await apiRateLimiter.pass(null, 0);
        if (!pass) {
            callback(null, false);
            return;
        }
        const valid = await verifyAPIKey(password);
        if (valid) { apiRateLimiter.removeTokens(1); }
        callback(null, valid);
    } catch (e) {
        log.error("api-auth", e);
        callback(null, false);
    }
}
```

---

### [H-6] Port Range Not Validated Server-Side

**File:** `server/server.js:830-832`, `server/model/monitor.js:validate()`  
**Severity:** high  
**Reproducible on:** all

`parseInt(monitor.port)` guards only against `NaN`. Values like `0`, `-1`, `99999` are accepted and stored.

**Fix:** Add to `Monitor.validate()`:

```js
if (this.port !== null && this.port !== undefined) {
    const p = Number(this.port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
        throw new Error("Port must be an integer between 1 and 65535");
    }
}
```

---

### [H-7] Missing Test Coverage for Critical Paths

**File:** `test/backend-test/`  
**Severity:** high

Gaps:
- Monitor CRUD with notification associations
- Permission enforcement (cross-user access blocked)
- Transaction rollback on partial failure
- API key auth bypass (C-1 above is untested)
- 2FA edge cases (backup codes, concurrent OTP use)

**Recommendation:** Add `test/backend-test/test-socket-auth.js` covering cross-user mutations. Add `test/backend-test/test-monitor-crud.js` covering full create→edit→delete lifecycle with DB assertions.

---

## Medium Priority

### [M-1] Silent JSON.parse Failures

**File:** `server/model/monitor.js:198, 209-210, 253, 369-371, 1309-1330, 1415-1422`  
**Severity:** medium  
**Reproducible on:** all

`toJSON()`, `getAcceptedStatuscodes()`, `updateTlsInfo()`, and domain expiry all call `JSON.parse()` on stored fields without try-catch. A corrupted row silently breaks monitoring or crashes the serialiser.

**Fix pattern** (apply to all sites):

```js
function safeJsonParse(str, fallback, label) {
    try { return JSON.parse(str); }
    catch (e) {
        log.warn("json", `Invalid JSON in ${label}: ${e.message}`);
        return fallback;
    }
}
```

---

### [M-2] Raw Exception Messages Leaked to Clients

**File:** `server/server.js:563, 713, 795, 968, 984, 1005, 1024, 1055, 1075, 1094, 1184+`  
**Severity:** medium

`callback({ ok: false, msg: error.message })` exposes SQL syntax, file paths, and stack frame context to the browser.

**Fix:** Create a central socket error helper:

```js
function socketError(callback, err, userMsg = "An unexpected error occurred") {
    log.error("socket", err);
    callback({ ok: false, msg: err.isUserFacing ? err.message : userMsg });
}
```

Tag known user-facing errors with `err.isUserFacing = true` before throwing.

---

### [M-3] Dialect Abstraction Incomplete

**File:** `server/model/monitor.js:270, 1303, 1335, 1400`  
**Severity:** medium

Some raw SQL lives outside `server/dialects/`. Any DB-specific SQL that escapes the dialect layer will fail on a different backend silently.

**Recommendation:** Grep for `knex.raw(` outside `server/dialects/` and move non-portable expressions into dialect hooks.

---

### [M-4] Authentication Middleware Not Enforced by Layer

**File:** `server/util-server.js` (`checkLogin`), all socket handlers  
**Severity:** medium

`checkLogin(socket)` must be called manually in every handler. One omission = auth bypass. There is no automatic enforcement.

**Fix:** Use a Socket.io middleware wrapper for authenticated events:

```js
function authedEvent(event, handler) {
    return (socket) => {
        socket.on(event, async (...args) => {
            try {
                await checkLogin(socket);
                await handler(socket, ...args);
            } catch (e) {
                const cb = args.find(a => typeof a === "function");
                if (cb) { cb({ ok: false, msg: e.message }); }
            }
        });
    };
}
```

---

### [M-5] Migration Lock Not Enforced

**File:** `server/database.js:282-299`  
**Severity:** medium

`knex.migrate.latest()` has no distributed lock. Simultaneous startup of two pods (Kubernetes) can corrupt migration state.

**Fix:** Use a `SELECT GET_LOCK()`/advisory lock before calling `migrate.latest()`, or document clearly that only one instance should bootstrap.

---

### [M-6] Monitor.toJSON() Signs JWT on Every Call

**File:** `server/model/monitor.js:128`  
**Severity:** medium

Screenshot URL is signed with `jwt.sign(this.id, secret)` each time `toJSON()` is called. For 1 000 monitors emitted per connection, this adds 1 000 synchronous JWT operations.

**Fix:** Cache the signed token on the instance (invalidate on `start()` / config change).

---

## Low Priority

### [L-1] console.* Calls Bypass Structured Logger

**File:** `server/model/monitor.js:1139`, `server/server.js:1989`  
**Severity:** low

**Fix:** Replace with `log.error` / `log.debug` from the existing `log` utility.

---

### [L-2] Connection Pool Has No Metrics

**File:** `server/database.js:20-39`  
**Severity:** low

Pool exhaustion is silent. No Prometheus gauge for pool size, waiting requests, or acquire timeout.

**Recommendation:** Expose `knex.client.pool.numUsed()` and `numFree()` to the Prometheus exporter.

---

### [L-3] Socket Handler Registration Not Extensible

**File:** `server/server.js:1699-1708`  
**Severity:** low

Each new handler requires a manual import + call in server.js. Auto-discovery (see H-1) eliminates this.

---

### [L-4] Request Correlation IDs Missing

**File:** all socket handlers  
**Severity:** low

Errors cannot be correlated across log lines for a single user session.

**Recommendation:** Generate a UUID per socket connection and thread it through log calls using `AsyncLocalStorage`.

---

## Implementation Roadmap

| Priority | Issue | Effort | Risk |
|----------|-------|--------|------|
| C-1 | API key auth bypass | S (2-line fix) | critical |
| C-2 | Transactions on multi-table writes | M (wrap 4-5 operations) | critical |
| H-1 | Extract remaining handlers from server.js | L (structural) | low |
| H-2 | Replace recursive hierarchy query with CTE | M (model + tests) | medium |
| H-3 | Cache static monitor config in-memory | M (cache + invalidation) | medium |
| H-4 | Maintenance status cache | S (Set + events) | low |
| H-5 | Fix unhandled rejections in auth.js | S (async/await) | low |
| H-6 | Port range validation | S (3-line add to validate()) | low |
| H-7 | Cross-user permission tests | M (new test file) | low |
| M-1 | `safeJsonParse` helper at all sites | S (utility fn) | low |
| M-2 | Socket error sanitisation | M (helper + sweep) | low |
| M-3 | Raw SQL in dialects sweep | S (grep + move) | low |
| M-4 | Socket auth middleware wrapper | M (refactor handlers) | medium |
| M-5 | Migration lock | S (advisory lock) | low |
| M-6 | Cache JWT in toJSON | S | low |

**Effort:** S < 1 day · M 1–3 days · L 3–7 days  
**Order of attack:** C-1 → C-2 → H-5 → H-6 → M-1 → H-4 → H-3 → H-2 → M-2 → M-4 → H-7 → H-1

---

## Positive Findings

- **Dialect abstraction** (`server/dialects/`) is well-structured; DB-specific code is isolated.
- **Knex migration chain** (`db/knex_migrations/`) is sequential and has forward-only safety.
- **Heartbeat rounding** (`$beforeInsert`/`$beforeUpdate`) correctly guards PG's strict INTEGER type.
- **testcontainers integration tests** give real multi-DB coverage that upstream lacks.
- **i18n audit tooling** (`extra/i18n-audit.js`) is reusable and CI-integrated.
- **Compact UI layer** (`src/assets/_compact.scss`) is additive and doesn't break upstream styling.
