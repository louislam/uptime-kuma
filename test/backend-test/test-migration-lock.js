process.env.UPTIME_KUMA_HIDE_LOG = [ "info_db", "info_server", "warn_db" ].join(",");

const { describe, test, afterEach } = require("node:test");
const assert = require("node:assert");
const Database = require("../../server/database");

/**
 * Save and restore Database.dbConfig around each test so we can flip the
 * dialect without leaking state into other suites that share the singleton.
 * @returns {object} Restorer with `.restore()` callable in afterEach
 */
function pinDbConfig() {
    const original = Database.dbConfig;
    return {
        set(value) {
            Database.dbConfig = value;
        },
        restore() {
            Database.dbConfig = original;
        },
    };
}

describe("Database.withMigrationLock()", () => {
    const guard = pinDbConfig();
    afterEach(() => guard.restore());

    test("sqlite: runs the inner function (no lock attempted)", async () => {
        guard.set({ type: "sqlite" });
        let ran = false;
        // No knex client needed because the SQLite branch never touches it.
        await Database.withMigrationLock({}, async () => {
            ran = true;
        });
        assert.strictEqual(ran, true, "inner fn must run on sqlite");
    });

    test("sqlite: propagates errors from the inner function", async () => {
        guard.set({ type: "sqlite" });
        await assert.rejects(
            () => Database.withMigrationLock({}, async () => {
                throw new Error("boom");
            }),
            /boom/,
            "errors from fn must surface to the caller"
        );
    });

    test("unknown dialect falls through to the no-lock branch", async () => {
        guard.set({ type: "totally-made-up-backend" });
        let ran = false;
        await Database.withMigrationLock({}, async () => {
            ran = true;
        });
        assert.strictEqual(ran, true, "unknown dialect must still run fn");
    });

    test("postgres: acquires lock, runs fn, releases lock on success", async () => {
        guard.set({ type: "postgres" });
        const calls = [];
        const fakeConn = { id: "conn-1" };
        const fakeKnex = {
            client: {
                acquireConnection: async () => {
                    calls.push("acquireConnection");
                    return fakeConn;
                },
                releaseConnection: async (conn) => {
                    calls.push([ "releaseConnection", conn.id ]);
                },
                query: async (conn, q) => {
                    calls.push([ "query", conn.id, q.sql ]);
                    return { response: [ [], [] ] };
                },
            },
        };
        let ranInside = false;
        await Database.withMigrationLock(fakeKnex, async () => {
            ranInside = true;
            calls.push("inside-fn");
        });
        assert.strictEqual(ranInside, true);
        assert.deepStrictEqual(calls, [
            "acquireConnection",
            [ "query", "conn-1", "SELECT pg_advisory_lock(?)" ],
            "inside-fn",
            [ "query", "conn-1", "SELECT pg_advisory_unlock(?)" ],
            [ "releaseConnection", "conn-1" ],
        ], "lock/unlock must run on the same pinned connection in order");
    });

    test("postgres: releases lock and connection even when fn throws", async () => {
        guard.set({ type: "postgres" });
        const calls = [];
        const fakeKnex = {
            client: {
                acquireConnection: async () => ({ id: "c" }),
                releaseConnection: async () => calls.push("releaseConnection"),
                query: async (_c, q) => {
                    calls.push(q.sql);
                    return { response: [ [], [] ] };
                },
            },
        };
        await assert.rejects(
            () => Database.withMigrationLock(fakeKnex, async () => {
                throw new Error("migration failed");
            }),
            /migration failed/,
        );
        assert.ok(calls.includes("SELECT pg_advisory_unlock(?)"), "unlock must run even on fn error");
        assert.ok(calls.includes("releaseConnection"), "connection must be released even on fn error");
    });

    test("mariadb: throws when GET_LOCK reports it could not be acquired", async () => {
        guard.set({ type: "mariadb" });
        const fakeKnex = {
            client: {
                acquireConnection: async () => ({ id: "c" }),
                releaseConnection: async () => {},
                // 0 = wait timeout expired without acquiring; null = error.
                query: async () => ({ response: [ [ { acquired: 0 } ], [] ] }),
            },
        };
        await assert.rejects(
            () => Database.withMigrationLock(fakeKnex, async () => {
                throw new Error("inner should not run");
            }),
            /Could not acquire migration lock/,
        );
    });

    test("mariadb: acquires GET_LOCK, runs fn, then RELEASE_LOCK on the same connection", async () => {
        guard.set({ type: "mariadb" });
        const calls = [];
        const fakeKnex = {
            client: {
                acquireConnection: async () => {
                    calls.push("acquire");
                    return { id: "lock-conn" };
                },
                releaseConnection: async (conn) => calls.push([ "release", conn.id ]),
                query: async (conn, q) => {
                    calls.push([ q.sql, conn.id ]);
                    if (q.sql.startsWith("SELECT GET_LOCK")) {
                        return { response: [ [ { acquired: 1 } ], [] ] };
                    }
                    return { response: [ [], [] ] };
                },
            },
        };
        let ranInside = false;
        await Database.withMigrationLock(fakeKnex, async () => {
            ranInside = true;
            calls.push("fn");
        });
        assert.strictEqual(ranInside, true);
        assert.deepStrictEqual(calls, [
            "acquire",
            [ "SELECT GET_LOCK(?, ?) AS acquired", "lock-conn" ],
            "fn",
            [ "SELECT RELEASE_LOCK(?)", "lock-conn" ],
            [ "release", "lock-conn" ],
        ]);
    });
});
