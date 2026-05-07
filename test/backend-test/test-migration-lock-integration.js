process.env.UPTIME_KUMA_HIDE_LOG = [ "info_db", "info_server", "warn_db" ].join(",");

const { describe, test } = require("node:test");
const assert = require("node:assert");
const knexLib = require("knex");
const { MariaDbContainer } = require("@testcontainers/mariadb");
const { PostgreSqlContainer } = require("@testcontainers/postgresql");
const Database = require("../../server/database");

/**
 * Sleep helper for in-fn dwell time.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Restore Database.dbConfig after each test so dialect flips don't leak.
 * @param {object} value
 * @returns {() => void}
 */
function pinDialect(value) {
    const original = Database.dbConfig;
    Database.dbConfig = value;
    return () => {
        Database.dbConfig = original;
    };
}

/**
 * Run two withMigrationLock calls concurrently and capture overlap.
 * Each fn records its own [start, end]. If the lock works, end_A <= start_B
 * (or vice versa) — there must be no overlap.
 * @param {import("knex").Knex} knex
 * @param {number} dwellMs how long each fn holds the lock
 * @returns {Promise<{a:[number,number],b:[number,number]}>}
 */
async function runConcurrentLockedSections(knex, dwellMs) {
    const ranges = { a: null, b: null };
    const work = (key) => Database.withMigrationLock(knex, async () => {
        const start = Date.now();
        await sleep(dwellMs);
        ranges[key] = [ start, Date.now() ];
    });
    await Promise.all([ work("a"), work("b") ]);
    return ranges;
}

/**
 * Assert two locked sections did not overlap.
 * @param {{a:[number,number],b:[number,number]}} ranges
 * @param {string} label
 */
function assertSerialised(ranges, label) {
    const { a, b } = ranges;
    assert.ok(a && b, `${label} both sections recorded ranges`);
    const noOverlap = a[1] <= b[0] || b[1] <= a[0];
    assert.ok(
        noOverlap,
        `${label} concurrent locked sections must not overlap. a=[${a[0]},${a[1]}] b=[${b[0]},${b[1]}]`
    );
}

describe("withMigrationLock — real DBMS integration", () => {

    test("SQLite: pass-through (no advisory lock attempted)", async () => {
        const restore = pinDialect({ type: "sqlite" });
        try {
            // Build the same Knex client shape Uptime Panda uses (knex's
            // sqlite3 dialect with the @louislam/sqlite3 driver swapped in).
            const KnexSqliteDialect = require("knex/lib/dialects/sqlite3/index.js");
            KnexSqliteDialect.prototype._driver = () => require("@louislam/sqlite3");
            const knex = knexLib({
                client: KnexSqliteDialect,
                connection: { filename: ":memory:" },
                useNullAsDefault: true,
            });
            try {
                let ran = false;
                await Database.withMigrationLock(knex, async () => {
                    ran = true;
                });
                assert.strictEqual(ran, true);

                // Two concurrent calls on SQLite serialise via Knex pool, but
                // withMigrationLock itself does no advisory lock. Verify both
                // fns run and complete cleanly.
                const ranges = await runConcurrentLockedSections(knex, 50);
                assert.ok(ranges.a && ranges.b);
            } finally {
                await knex.destroy();
            }
        } finally {
            restore();
        }
    });

    test(
        "MariaDB: GET_LOCK actually serialises concurrent migration entries",
        {
            skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
        },
        async () => {
            const container = await new MariaDbContainer("mariadb:12")
                .withStartupTimeout(120000)
                .start();
            try {
                const restore = pinDialect({ type: "mariadb" });
                // Pool size 4 so we have headroom for both lock connections
                // plus the inner fn's connections.
                const knex = knexLib({
                    client: "mysql2",
                    connection: {
                        host: container.getHost(),
                        port: container.getPort(),
                        user: container.getUsername(),
                        password: container.getUserPassword(),
                        database: container.getDatabase(),
                    },
                    pool: { min: 1, max: 4 },
                });
                try {
                    // Single-call sanity: lock acquired and released, fn runs.
                    let ran = false;
                    await Database.withMigrationLock(knex, async () => {
                        ran = true;
                    });
                    assert.strictEqual(ran, true, "MariaDB single fn ran");

                    // GET_LOCK must be released — a fresh acquire on the SAME
                    // name should succeed immediately (proving the unlock ran).
                    const reacquire = await knex.raw("SELECT GET_LOCK('uptime_kuma_migration', 1) AS acquired");
                    const reRows = Array.isArray(reacquire) ? reacquire[0] : reacquire?.rows ?? reacquire;
                    const reAcq = Array.isArray(reRows) ? reRows[0]?.acquired : reRows?.acquired;
                    assert.strictEqual(Number(reAcq), 1, "MariaDB lock was released after withMigrationLock returned");
                    await knex.raw("SELECT RELEASE_LOCK('uptime_kuma_migration')");

                    // Concurrency: two locked sections must not overlap.
                    const ranges = await runConcurrentLockedSections(knex, 400);
                    assertSerialised(ranges, "MariaDB");

                    // Failure path: error thrown inside fn must release the lock.
                    await assert.rejects(
                        () => Database.withMigrationLock(knex, async () => {
                            throw new Error("simulated migration failure");
                        }),
                        /simulated migration failure/,
                    );
                    const after = await knex.raw("SELECT GET_LOCK('uptime_kuma_migration', 1) AS acquired");
                    const afterRows = Array.isArray(after) ? after[0] : after?.rows ?? after;
                    const afterAcq = Array.isArray(afterRows) ? afterRows[0]?.acquired : afterRows?.acquired;
                    assert.strictEqual(Number(afterAcq), 1, "MariaDB lock released after fn threw");
                    await knex.raw("SELECT RELEASE_LOCK('uptime_kuma_migration')");
                } finally {
                    await knex.destroy();
                    restore();
                }
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
        "PostgreSQL: pg_advisory_lock actually serialises concurrent entries",
        {
            skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
        },
        async () => {
            const container = await new PostgreSqlContainer("postgres:16-alpine")
                .withStartupTimeout(120000)
                .start();
            try {
                const restore = pinDialect({ type: "postgres" });
                const knex = knexLib({
                    client: "pg",
                    connection: {
                        host: container.getHost(),
                        port: container.getPort(),
                        user: container.getUsername(),
                        password: container.getPassword(),
                        database: container.getDatabase(),
                    },
                    pool: { min: 1, max: 4 },
                });
                try {
                    const LOCK_KEY = 0x554B4D41;

                    // Single-call sanity.
                    let ran = false;
                    await Database.withMigrationLock(knex, async () => {
                        ran = true;
                    });
                    assert.strictEqual(ran, true, "PG single fn ran");

                    // Lock state — pg_advisory_lock is session-scoped, so a
                    // fresh acquisition from a NEW session must succeed.
                    // pg_try_advisory_lock returns true when granted; we then
                    // release immediately.
                    const tryAcq = await knex.raw("SELECT pg_try_advisory_lock(?) AS got", [ LOCK_KEY ]);
                    assert.strictEqual(tryAcq.rows[0].got, true, "PG lock available after withMigrationLock returned");
                    await knex.raw("SELECT pg_advisory_unlock(?)", [ LOCK_KEY ]);

                    // Concurrency.
                    const ranges = await runConcurrentLockedSections(knex, 400);
                    assertSerialised(ranges, "PostgreSQL");

                    // Failure path: lock released after exception.
                    await assert.rejects(
                        () => Database.withMigrationLock(knex, async () => {
                            throw new Error("simulated migration failure");
                        }),
                        /simulated migration failure/,
                    );
                    const tryAfter = await knex.raw("SELECT pg_try_advisory_lock(?) AS got", [ LOCK_KEY ]);
                    assert.strictEqual(tryAfter.rows[0].got, true, "PG lock released after fn threw");
                    await knex.raw("SELECT pg_advisory_unlock(?)", [ LOCK_KEY ]);
                } finally {
                    await knex.destroy();
                    restore();
                }
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
