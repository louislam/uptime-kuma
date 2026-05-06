# Database Layer

Uptime Kuma supports three databases through a single ORM layer:

| DB | Driver | Default port | Notes |
|---|---|---|---|
| **SQLite** | `@louislam/sqlite3` | n/a | Default; single file at `data/kuma.db` |
| **MariaDB / MySQL** | `mysql2` | 3306 | External or embedded (Docker image) |
| **PostgreSQL** | `pg` | 5432 | External only |

## Stack

- **[Knex.js](https://knexjs.org/)** — query builder + migrations (`db/knex_migrations/`)
- **[Objection.js](https://vincit.github.io/objection.js/)** — ORM model layer on top of Knex
- **Dialect strategy** (`server/dialects/`) — one subclass per backend; all dialect-specific behavior lives there

`server/db.js` owns the singleton: `setupKnex(instance)` once at boot, then `getKnex()` everywhere.

## Selecting a database

### Via env vars (Docker / production)

```
UPTIME_KUMA_DB_TYPE=postgres          # sqlite | mariadb | postgres | embedded-mariadb
UPTIME_KUMA_DB_HOSTNAME=db.host
UPTIME_KUMA_DB_PORT=5432              # 3306 for mariadb, 5432 for postgres
UPTIME_KUMA_DB_NAME=kuma
UPTIME_KUMA_DB_USERNAME=kuma
UPTIME_KUMA_DB_PASSWORD=kuma
UPTIME_KUMA_DB_SSL=true               # optional
UPTIME_KUMA_DB_CA=<PEM>               # optional CA cert
UPTIME_KUMA_DB_SOCKET=/path/to/sock   # MariaDB unix socket; mutually exclusive with hostname/port
```

`*_FILE` variants (e.g. `UPTIME_KUMA_DB_PASSWORD_FILE`) read from a Docker secrets file.

### Via setup UI

If `db-config.json` is missing on first start, Uptime Kuma serves a setup page where you pick the type and enter credentials.

### Via `data/db-config.json`

```json
{
  "type": "postgres",
  "hostname": "db.host",
  "port": 5432,
  "dbName": "kuma",
  "username": "kuma",
  "password": "kuma",
  "ssl": false
}
```

## Compose examples

Production (pulls `louislam/uptime-kuma:2` from upstream):

- `compose.yaml` — SQLite (default)
- `compose.mariadb.yaml` — Uptime Kuma + external MariaDB 11
- `compose.postgres.yaml` — Uptime Kuma + external PostgreSQL 16

Development (builds the image from the local source tree via `docker/dockerfile.dev`):

- `compose.dev.yaml` — Uptime Kuma + PostgreSQL, builds the image so local
  changes ship in the running container. Run `docker compose -f compose.dev.yaml up --build`.
  PG is exposed on host port `5433` for `psql` debugging; an optional
  MariaDB service block at the bottom (commented out) exposes `:3308`.
  State lives under `./data/dev/`. The dev image is built from
  `node:24-bookworm-slim` directly — no dependency on upstream's
  `louislam/uptime-kuma:base2` image — and ships with `iputils-ping`,
  `mariadb-server` (for the embedded-MariaDB option in the wizard) and
  the usual `dumb-init` / `ca-certificates`.

Use this when you need to test the production image with branch changes,
e.g. reproducing a PG-only bug. For frontend hot-reload, run `npm run dev`
on the host instead.

**LAN-monitor caveat (macOS Docker Desktop).** Containers can reach the
internet but not 192.168.x.y devices on the host's LAN — Docker Desktop
runs in a Linux VM whose default route does not bridge to the host's
local subnet, even with `network_mode: host`. macvlan is unsupported on
Mac. To exercise ping / HTTP monitors against LAN devices, leave the
`postgres` service up via compose and run Uptime Kuma natively:

```bash
docker compose -f compose.dev.yaml up -d postgres
UPTIME_KUMA_DB_TYPE=postgres \
UPTIME_KUMA_DB_HOSTNAME=localhost \
UPTIME_KUMA_DB_PORT=5433 \
UPTIME_KUMA_DB_NAME=kuma \
UPTIME_KUMA_DB_USERNAME=kuma \
UPTIME_KUMA_DB_PASSWORD=kuma \
npm run start-server-dev
```

The host-native process inherits the Mac's full LAN access. The
container path stays useful for testing the DB layer / ORM / migrations.

## Adding a model

```js
// server/model/widget.js
const { BaseModel } = require("./base-model");

class Widget extends BaseModel {
    /**
     * @returns {string} Table name
     */
    static get tableName() {
        return "widget";
    }

    toJSON() {
        return { id: this.id, name: this.name };
    }
}

const { registerModel } = require("../utils/model-registry");
registerModel("widget", Widget);
module.exports = Widget;
```

`registerModel` keeps a name → class map for places that need to look a model up by table name.

## Adding a migration

```bash
db/knex_migrations/2026-01-15-1430-add-widget.js
```

```js
exports.up = function (knex) {
    return knex.schema.createTable("widget", (table) => {
        table.increments("id");
        table.string("name", 255).notNullable();
        table.integer("user_id").unsigned().references("id").inTable("user");
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable("widget");
};
```

**Rules:**
- Primary key is always `id`.
- Use Knex schema builder; **never raw dialect-specific SQL** (backticks, brackets, `AUTO_INCREMENT`, etc.).
- Filename: `YYYY-MM-DD-HHMM-name.js` — ordering is lexicographic.
- Test new migrations against all three dialects (see Testing below).

## Snake_case columns

DB columns are `snake_case` (e.g. `user_id`, `retry_interval`). Models read and write the columns directly: `bean.user_id`, not `bean.userId`. Where the API contract requires camelCase (frontend expects `retryInterval` etc.), translate at the boundary — typically in the model's `toJSON()` for outbound responses, and in the socket handler that receives the payload for inbound writes (`server.js#editMonitor` is the canonical example: it builds an explicit snake-keyed payload from the camel-keyed socket input before passing to `bean.$query().patchAndFetch(payload)`).

**Footguns:**

- Raw Knex calls don't get translated. `knex("monitor").where("monitorId", x)` sends `monitorId` verbatim — zero rows on SQLite/MariaDB, error on PG. Use the snake column name.
- The frontend speaks camelCase. When you receive a payload from a socket handler, the keys are camelCase; either translate them to snake when constructing the DB-write payload (see `server.js#editMonitor`), or run the payload through a `camelToSnake` key-rename before insert/patch.

## Querying

Use Knex/Objection directly.

```js
const { getKnex } = require("./db");
const Monitor = require("./model/monitor");

// Knex builder
const rows = await getKnex()("monitor").where("user_id", uid);

// Objection query
const monitors = await Monitor.query().where("user_id", uid);
```

## Booleans

PostgreSQL distinguishes `1` from `true`. SQLite and MariaDB tolerate both, but PG does not. For any column declared `table.boolean(...)` in `db/knex_init_db.js` or a migration:

- **Write side:** emit `true`/`false`, not `1`/`0`.
- **Read side:** wrap with `Boolean(value)` for cross-dialect comparisons. SQLite/MariaDB return `0`/`1`; PG returns `true`/`false`.

```js
// good
await knex("monitor").where("active", true).update({ important: false });
if (Boolean(user.twofa_status)) { ... }

// bad — silently fails on PG
await knex("monitor").where("active", 1);
if (user.twofa_status === 1) { ... }
```

## Integer columns

PostgreSQL is strict about INTEGER vs FLOAT: an `INSERT ... (ping) VALUES (3.208)` against an INTEGER column fails with `invalid input syntax for type bigint: "3.208"`. SQLite stores fractional values loosely; MariaDB silently rounds. Two places in this codebase routinely produce fractional values for integer columns:

- `Heartbeat.ping` — assigned from sub-millisecond HTTP/port-check timings.
- `Heartbeat.duration` — same (computed from `dayjs().valueOf()` deltas).

`server/model/heartbeat.js#$beforeInsert` / `$beforeUpdate` round both fields. New code that writes to integer columns from a fractional source needs the same treatment, either at the call site or in a model lifecycle hook.

## Dialect strategy pattern

All per-dialect behavior lives in `server/dialects/*.js`. Each subclass of `Dialect` (defined in `server/dialects/dialect.js`) owns:

- `validateSetupConfig()` — required fields for the setup wizard
- `testConnection()` — short-lived probe before saving config
- `preConnect()` — out-of-band setup (`CREATE DATABASE`, embedded MariaDB process start, mysql2 column-compiler patch, …)
- `buildKnexConfig({ testMode, acquireConnectionTimeout, poolMaxConnections })` — Knex config for the pool
- `postConnect(knex, opts)` — post-pool setup (PRAGMA logs, base-table bootstrap via `_initExternalDB`)
- `sqlHourOffset()` — fragment yielding `NOW() + N hours` (placeholder accepts negative for past)
- Lifecycle hooks: `beforeMigrations`, `afterMigrations`, `beforeClose`
- Maintenance hooks: `shrink`, `optimize`, `incrementalVacuum`, `getSize`

To add a new backend: drop a subclass under `server/dialects/`, register it in `server/dialects/index.js`. The orchestrator code in `Database` and the setup router talks to the strategy interface — no `if (dbConfig.type === ...)` branches.

## `raw()` result shape

Cross-dialect helper in `server/utils/db-result.js`:

- **PostgreSQL** — `{ rows: [...] }`
- **MySQL/MariaDB** — `[rows, fields]`
- **SQLite (`@louislam/sqlite3`)** — rows array directly

Wrap any `knex.raw(...)` call that returns rows with `normalizeRows(result)`.

## Testing

Backend tests use `node:test` and live in `test/backend-test/`.

- `test-dialect.js` — dialect registry + each subclass's contract
- `test-base-model.js` — model surface + registry, no aliasing
- `test-db-helpers.js` — `db.js` singleton lifecycle, datetime helpers
- `test-migration.js` — runs all migrations against SQLite + MariaDB + MySQL + PostgreSQL (containers via `testcontainers`)
- `test-cross-db.js` — same end-to-end CRUD exercise across all three dialects
- `test-monitor-types.js` — integration tests for each MonitorType subclass: spins up real Postgres / MariaDB / MongoDB / Redis / RabbitMQ / Mosquitto / snmpd via testcontainers and asserts `MonitorType.check()` reports UP. Also locks in regressions for the heartbeat ping-rounding rule and the MQTT default-check-type bug.

Run:

```bash
npm run test-backend
```

Container-based tests skip on non-Linux/x64 CI runners but execute locally if Docker is available.

### Cross-dialect test isolation

Tests that switch dialects must flush the require cache for `/server/**` and `/db/**` (modules capture `getKnex` closures at load time) and call `Settings.stopCacheCleaner()` (60s setInterval otherwise prevents process exit). See `test-cross-db.js` `reloadModules()` for the pattern.

### Running the monitor-type integration suite locally

`test-monitor-types.js` self-skips on non-Linux/x64 unless `RUN_INTEGRATION_TESTS=1` is set:

```bash
RUN_INTEGRATION_TESTS=1 node --test test/backend-test/test-monitor-types.js
```

A few caveats hit during macOS development:

- **Module load order matters.** Require `UptimeKumaServer` *before* `Monitor`. The two have a circular dep; importing `Monitor` first hands `monitor-types/group.js` a half-initialised `{}` snapshot of the class and `Monitor.getChildren` ends up undefined at check time. The test file does this correctly at the top — keep that ordering when adding new tests.
- **SNMP target.** macOS Docker Desktop's vmnet bridge does not forward container UDP ports reliably, so the SNMP test cannot use a containerised snmpd on macOS. The suite probes a host-native snmpd at `127.0.0.1:161` (override with `SNMP_TEST_HOST` / `SNMP_TEST_PORT`) and self-skips if nothing answers, with an actionable hint. Linux runners use the testcontainer path. To run SNMP locally on macOS:

  ```bash
  echo "rocommunity public" > /tmp/snmpd.conf
  sudo /usr/sbin/snmpd -f -c /tmp/snmpd.conf -Lo &
  RUN_INTEGRATION_TESTS=1 SNMP_TEST_HOST=127.0.0.1 \
    node --test test/backend-test/test-monitor-types.js
  ```

- **HARDCODED-vs-MonitorType split.** Several monitor types (http, keyword, json-query, ping, push, steam, docker, radius, kafka-producer) are still inlined in `Monitor.beat()` rather than implementing the `MonitorType` subclass contract. `test-monitor-types.js` covers only the subclass-based types — adding integration coverage for the inlined ones requires driving `Monitor.beat()` through the full app lifecycle and isn't worth the test machinery for now.
