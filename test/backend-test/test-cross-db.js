const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
const { MariaDbContainer } = require("@testcontainers/mariadb");
const { PostgreSqlContainer } = require("@testcontainers/postgresql");

/**
 * Reset the Database singleton + cached modules so each backend run is
 * independent. We can't share state between dialect tests because
 * Database.dbConfig and the Knex singleton are global.
 * @returns {object} Fresh module references
 */
function reloadModules() {
    // Flush every server/db/migration/model module from the require cache so
    // each backend run gets a fresh closure on the new Knex singleton.
    const serverDir = path.resolve(__dirname, "../../server");
    const dbDir = path.resolve(__dirname, "../../db");
    for (const key of Object.keys(require.cache)) {
        if (key.startsWith(serverDir + path.sep) || key.startsWith(dbDir + path.sep)) {
            delete require.cache[key];
        }
    }
    return {
        Database: require("../../server/database"),
        Tag: require("../../server/model/tag"),
        Monitor: require("../../server/model/monitor"),
        Heartbeat: require("../../server/model/heartbeat"),
        getKnex: require("../../server/db").getKnex,
        normalizeRows: require("../../server/utils/db-result").normalizeRows,
    };
}

/**
 * Drive the same exercise across SQLite/MariaDB/PostgreSQL backends.
 * Validates: connect → patch → CRUD via Knex/Objection → sqlHourOffset → close.
 * @param {object} opts Options
 * @param {string} opts.label Backend label
 * @param {string} opts.dataDir Test data directory
 * @param {object} opts.dbConfig db-config.json contents
 * @param {string} opts.expectedHourOffsetSql Expected sqlHourOffset() output
 * @returns {Promise<void>}
 */
async function exerciseBackend({ label, dataDir, dbConfig, expectedHourOffsetSql }) {
    // Always start from a clean data directory so leftover state from a prior
    // run never leaks into the current dialect.
    if (fs.existsSync(dataDir)) {
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "db-config.json"), JSON.stringify(dbConfig));

    const { Database, Tag, Monitor, Heartbeat, getKnex, normalizeRows } = reloadModules();
    Database.initDataDir({ "data-dir": dataDir });
    Database.dbConfig = dbConfig;
    await Database.connect(true, true, true);
    await Database.patch();

    try {
        const knex = getKnex();

        // sqlHourOffset matches expected dialect
        assert.strictEqual(Database.sqlHourOffset(), expectedHourOffsetSql, `${label} sqlHourOffset`);

        // hour-offset SQL actually executes AND its arithmetic returns a value
        // that is ~1 hour in the past (within 5 seconds of dayjs's expectation).
        // Driver quirk: pg returns Date objects (UTC string interpreted as local
        // by the driver), mysql2 is configured to return DATETIME as a raw string,
        // sqlite returns a string. Normalise by formatting then re-parsing as UTC.
        const offsetResult = await knex.raw(`SELECT ${Database.sqlHourOffset()} AS t`, [ -1 ]);
        const offsetRows = normalizeRows(knex, offsetResult);
        assert.ok(offsetRows[0]?.t != null, `${label} hour-offset query returned non-empty`);
        const rawOffset = offsetRows[0].t;
        const offsetActual =
            rawOffset instanceof Date
                // pg path: server emitted a UTC wall-clock string, driver parsed it
                // in local TZ. Re-interpret the naive components as UTC.
                ? dayjs.utc(dayjs(rawOffset).format("YYYY-MM-DD HH:mm:ss"))
                : dayjs.utc(rawOffset);
        assert.ok(offsetActual.isValid(), `${label} hour-offset returned a parseable timestamp (got ${rawOffset})`);
        const offsetExpected = dayjs.utc().subtract(1, "hour");
        const offsetDriftSeconds = Math.abs(offsetActual.diff(offsetExpected, "second"));
        assert.ok(
            offsetDriftSeconds < 5,
            `${label} hour-offset arithmetic drift ${offsetDriftSeconds}s exceeds 5s tolerance ` +
            `(actual=${offsetActual.toISOString()}, expected≈${offsetExpected.toISOString()})`
        );

        // Objection insert + load + delete round-trip on a registered model
        const inserted = await Tag.query().insert({
            name: `${label}-tag`,
            color: "#abc",
        });
        assert.ok(inserted.id > 0, `${label} insert returned id`);

        const reloaded = await Tag.query().findById(inserted.id);
        assert.strictEqual(reloaded.name, `${label}-tag`, `${label} findById name`);

        // Knex builder: insert + select on a non-model table (setting)
        await knex("setting").insert({
            key: `cross-db-${label}`,
            value: "x",
            type: "general",
        });
        const settingRow = await knex("setting").where("key", `cross-db-${label}`).first();
        assert.strictEqual(settingRow.value, "x", `${label} setting round-trip`);

        // count
        const tagCountRow = await Tag.query().count({ c: "*" }).first();
        const tagCount = Number(tagCountRow?.c ?? 0);
        assert.ok(tagCount >= 1, `${label} tag count`);

        // where + delete
        const found = await Tag.query().where("name", `${label}-tag`);
        assert.strictEqual(found.length, 1, `${label} where lookup`);

        await reloaded.$query().delete();
        const after = await Tag.query().findById(inserted.id);
        assert.strictEqual(after, undefined, `${label} delete removes row`);

        // Monitor insert with snake_case retry_interval, then verify mirror
        // exposes camelCase alias on load (per dialect — covers $parseDatabaseJson
        // working through the real driver, not just the unit shim).
        const monitor = await Monitor.query().insert({
            name: `${label}-mon`,
            type: "http",
            url: "https://example.com",
            interval: 60,
            retry_interval: 30,
            user_id: null,
        });
        assert.ok(monitor.id > 0, `${label} monitor insert returned id`);
        const monitorLoaded = await Monitor.query().findById(monitor.id);
        assert.strictEqual(Number(monitorLoaded.retry_interval), 30, `${label} monitor.retry_interval round-trip`);
        assert.strictEqual(Number(monitorLoaded.retryInterval), 30, `${label} monitor.retryInterval mirror`);

        // Heartbeat insert via Objection — needs a Monitor first (FK).
        const heartbeatTime = dayjs.utc().format("YYYY-MM-DD HH:mm:ss");
        const hb = await Heartbeat.query().insert({
            monitor_id: monitor.id,
            status: 1,
            time: heartbeatTime,
            ping: 50,
            msg: "ok",
            important: 0,
        });
        assert.ok(hb.id > 0, `${label} heartbeat insert returned id`);
        const hbLoaded = await Heartbeat.query().findById(hb.id);
        // pg returns some integer columns as strings; coerce numerically for
        // cross-dialect comparison. The point of the assertion is "the value
        // round-tripped", not the JS-type identity (which differs by driver).
        assert.strictEqual(Number(hbLoaded.monitor_id), monitor.id, `${label} heartbeat.monitor_id`);
        assert.strictEqual(Number(hbLoaded.status), 1, `${label} heartbeat.status`);
        assert.strictEqual(Number(hbLoaded.ping), 50, `${label} heartbeat.ping`);
        assert.strictEqual(hbLoaded.msg, "ok", `${label} heartbeat.msg`);
        // SQLite stores booleans as 0/1; PG returns true/false. Wrap in Boolean()
        // for cross-dialect comparison.
        assert.strictEqual(Boolean(hbLoaded.important), false, `${label} heartbeat.important = false (got ${hbLoaded.important})`);
        // camelCase alias mirror should also be exposed
        assert.strictEqual(Number(hbLoaded.monitorId), monitor.id, `${label} heartbeat.monitorId mirror`);

        // ----- Boolean round-trip (regression for the PG int-vs-bool BLOCKER) -----
        // Pre-fix code wrote `active: 1`/`upside_down: 0` and read with `=== 1`.
        // On PostgreSQL with a real BOOLEAN column those compares always failed;
        // wrapping reads in Boolean() and writing real true/false is the cross-dialect contract.
        const monitorWithBools = await Monitor.query().insert({
            name: `${label}-bool-monitor`,
            type: "http",
            url: "https://example.com/bools",
            interval: 60,
            active: true,
            upside_down: false,
            user_id: null,
        });
        const monitorBoolReloaded = await Monitor.query().findById(monitorWithBools.id);
        assert.strictEqual(Boolean(monitorBoolReloaded.active), true, `${label} active true`);
        assert.strictEqual(Boolean(monitorBoolReloaded.upside_down), false, `${label} upside_down false`);

        // Direct WHERE filter on a boolean column with `true` literal must return the row.
        // Pre-fix code passed integer 1 to .where() — broken on PG.
        const activeMatches = await Monitor.query()
            .where("active", true)
            .andWhere("name", `${label}-bool-monitor`);
        assert.strictEqual(activeMatches.length, 1, `${label} where("active", true) returned the row`);

        // Database.countRows must return a Number on every dialect (the BLOCKER).
        // On PG, COUNT(*) is BIGINT and the driver returns it as a string. The helper
        // wraps with Number(); the original code did `count !== 0` which was always
        // true for `"0" !== 0`, blocking setup on PG forever.
        const userCount = await Database.countRows("user");
        assert.strictEqual(typeof userCount, "number", `${label} countRows is a Number`);
        assert.strictEqual(userCount, 0, `${label} userCount === 0 (PG BIGINT BLOCKER regression)`);

        // Transaction rollback: insert a Tag inside trx, throw, assert no row remains.
        const rollbackName = `${label}-rollback-tag`;
        await assert.rejects(async () => {
            await knex.transaction(async (trx) => {
                await Tag.query(trx).insert({ name: rollbackName,
                    color: "#fff" });
                throw new Error("force-rollback");
            });
        }, /force-rollback/);
        const stillThere = await Tag.query().where("name", rollbackName);
        assert.strictEqual(stillThere.length, 0, `${label} transaction rollback removed the inserted row`);
    } finally {
        // Stop the freshly-required Settings cache cleaner; otherwise its
        // 60s setInterval keeps the test process alive.
        const { Settings } = require("../../server/settings");
        Settings.stopCacheCleaner();
        await Database.close();
    }
}

describe("Cross-DB integration (Objection + Knex against each dialect)", () => {
    test("SQLite", async () => {
        const dataDir = path.join(__dirname, "../../data/test-cross-db-sqlite");
        await exerciseBackend({
            label: "sqlite",
            dataDir,
            dbConfig: { type: "sqlite" },
            expectedHourOffsetSql: "DATETIME('now', ? || ' hours')",
        });
    });

    test(
        "MariaDB",
        {
            skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
        },
        async () => {
            const container = await new MariaDbContainer("mariadb:12")
                .withStartupTimeout(120000)
                .start();
            try {
                const dataDir = path.join(__dirname, "../../data/test-cross-db-mariadb");
                await exerciseBackend({
                    label: "mariadb",
                    dataDir,
                    dbConfig: {
                        type: "mariadb",
                        hostname: container.getHost(),
                        port: container.getPort(),
                        username: container.getUsername(),
                        password: container.getUserPassword(),
                        dbName: container.getDatabase(),
                    },
                    expectedHourOffsetSql: "DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR)",
                });
            } finally {
                try {
                    await container.stop();
                } catch {
                    // ignore
                }
            }
        }
    );

    test(
        "PostgreSQL",
        {
            skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
        },
        async () => {
            const container = await new PostgreSqlContainer("postgres:16-alpine")
                .withStartupTimeout(120000)
                .start();
            try {
                const dataDir = path.join(__dirname, "../../data/test-cross-db-postgres");
                await exerciseBackend({
                    label: "postgres",
                    dataDir,
                    dbConfig: {
                        type: "postgres",
                        hostname: container.getHost(),
                        port: container.getPort(),
                        username: container.getUsername(),
                        password: container.getPassword(),
                        dbName: container.getDatabase(),
                    },
                    expectedHourOffsetSql: "(NOW() AT TIME ZONE 'UTC') + (? || ' hours')::interval",
                });
            } finally {
                try {
                    await container.stop();
                } catch {
                    // ignore
                }
            }
        }
    );
});
