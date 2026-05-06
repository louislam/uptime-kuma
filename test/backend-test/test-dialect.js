const { describe, test } = require("node:test");
const assert = require("node:assert");
const {
    Dialect,
    SqliteDialect,
    MariadbDialect,
    EmbeddedMariadbDialect,
    PostgresDialect,
    dialectFor,
    supportedTypes,
} = require("../../server/dialects");

describe("Dialect registry", () => {
    test("supportedTypes lists all four backends", () => {
        const types = supportedTypes().sort();
        assert.deepStrictEqual(types, [ "embedded-mariadb", "mariadb", "postgres", "sqlite" ]);
    });

    test("dialectFor returns the matching subclass", () => {
        assert.ok(dialectFor({ type: "sqlite" }) instanceof SqliteDialect);
        assert.ok(dialectFor({ type: "mariadb" }) instanceof MariadbDialect);
        assert.ok(dialectFor({ type: "embedded-mariadb" }) instanceof EmbeddedMariadbDialect);
        assert.ok(dialectFor({ type: "postgres" }) instanceof PostgresDialect);
    });

    test("dialectFor returns null for unknown type", () => {
        assert.strictEqual(dialectFor({ type: "oracle" }), null);
        assert.strictEqual(dialectFor({ type: "" }), null);
    });

    test("EmbeddedMariadbDialect inherits from MariadbDialect", () => {
        assert.ok(EmbeddedMariadbDialect.prototype instanceof MariadbDialect);
    });
});

describe("Dialect static metadata", () => {
    test("requiresExternal flag", () => {
        assert.strictEqual(SqliteDialect.requiresExternal, false);
        assert.strictEqual(EmbeddedMariadbDialect.requiresExternal, false);
        assert.strictEqual(MariadbDialect.requiresExternal, true);
        assert.strictEqual(PostgresDialect.requiresExternal, true);
    });

    test("defaultPort matches the canonical port for external backends", () => {
        assert.strictEqual(MariadbDialect.defaultPort, 3306);
        assert.strictEqual(PostgresDialect.defaultPort, 5432);
        assert.strictEqual(SqliteDialect.defaultPort, null);
    });

    test("type identifier matches db-config.type values", () => {
        assert.strictEqual(SqliteDialect.type, "sqlite");
        assert.strictEqual(MariadbDialect.type, "mariadb");
        assert.strictEqual(EmbeddedMariadbDialect.type, "embedded-mariadb");
        assert.strictEqual(PostgresDialect.type, "postgres");
    });
});

describe("Dialect.sqlHourOffset()", () => {
    test("SQLite uses DATETIME(now, ?  hours)", () => {
        const d = new SqliteDialect({ type: "sqlite" });
        assert.strictEqual(d.sqlHourOffset(), "DATETIME('now', ? || ' hours')");
    });

    test("MariaDB uses DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR)", () => {
        const d = new MariadbDialect({ type: "mariadb" });
        assert.strictEqual(d.sqlHourOffset(), "DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR)");
    });

    test("EmbeddedMariadb inherits the MariaDB SQL fragment", () => {
        const d = new EmbeddedMariadbDialect({ type: "embedded-mariadb" });
        assert.strictEqual(d.sqlHourOffset(), "DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR)");
    });

    test("PostgreSQL uses (NOW() AT TIME ZONE 'UTC') + (?)::interval", () => {
        const d = new PostgresDialect({ type: "postgres" });
        assert.strictEqual(d.sqlHourOffset(), "(NOW() AT TIME ZONE 'UTC') + (? || ' hours')::interval");
    });

    test("base Dialect throws (abstract)", () => {
        const d = new Dialect({ type: "x" });
        assert.throws(() => d.sqlHourOffset(), /not implemented/);
    });
});

describe("Dialect.validateSetupConfig()", () => {
    test("SQLite accepts an empty config", () => {
        const d = new SqliteDialect({ type: "sqlite" });
        assert.doesNotThrow(() => d.validateSetupConfig());
    });

    test("EmbeddedMariadb accepts an empty config", () => {
        const d = new EmbeddedMariadbDialect({ type: "embedded-mariadb" });
        assert.doesNotThrow(() => d.validateSetupConfig());
    });

    test("MariaDB requires hostname/port without socket", () => {
        const d = new MariadbDialect({ type: "mariadb" });
        assert.throws(() => d.validateSetupConfig(), /Hostname is required/);
    });

    test("MariaDB accepts socketPath via env", () => {
        const original = process.env.UPTIME_KUMA_DB_SOCKET;
        process.env.UPTIME_KUMA_DB_SOCKET = "/tmp/mariadb.sock";
        try {
            const d = new MariadbDialect({
                type: "mariadb",
                dbName: "kuma",
                username: "kuma",
                password: "kuma",
            });
            d.validateSetupConfig();
            assert.strictEqual(d.config.socketPath, "/tmp/mariadb.sock");
        } finally {
            if (original === undefined) {
                delete process.env.UPTIME_KUMA_DB_SOCKET;
            } else {
                process.env.UPTIME_KUMA_DB_SOCKET = original;
            }
        }
    });

    test("MariaDB requires dbName/username/password", () => {
        const d = new MariadbDialect({
            type: "mariadb",
            hostname: "h",
            port: 3306,
        });
        assert.throws(() => d.validateSetupConfig(), /Database name is required/);
    });

    test("PostgreSQL requires hostname/port/dbName/username/password", () => {
        const d = new PostgresDialect({ type: "postgres" });
        assert.throws(() => d.validateSetupConfig(), /required/);
    });

    test("PostgreSQL accepts a complete config", () => {
        const d = new PostgresDialect({
            type: "postgres",
            hostname: "h",
            port: 5432,
            dbName: "kuma",
            username: "kuma",
            password: "kuma",
        });
        assert.doesNotThrow(() => d.validateSetupConfig());
    });
});

describe("Dialect default lifecycle hooks (no-op)", () => {
    test("preConnect / postConnect / beforeMigrations / afterMigrations / beforeClose all resolve", async () => {
        const d = new Dialect({ type: "x" });
        await assert.doesNotReject(d.preConnect());
        await assert.doesNotReject(d.postConnect(null, { noLog: true }));
        await assert.doesNotReject(d.beforeMigrations(null));
        await assert.doesNotReject(d.afterMigrations(null));
        await assert.doesNotReject(d.beforeClose(null));
    });

    test("shrink / optimize / incrementalVacuum default to no-op", async () => {
        const d = new Dialect({ type: "x" });
        await assert.doesNotReject(d.shrink(null));
        await assert.doesNotReject(d.optimize(null));
        await assert.doesNotReject(d.incrementalVacuum(null));
    });

    test("getSize defaults to 0", async () => {
        const d = new Dialect({ type: "x" });
        assert.strictEqual(await d.getSize(), 0);
    });

    test("testConnection defaults to no-op", async () => {
        const d = new Dialect({ type: "x" });
        await assert.doesNotReject(d.testConnection());
    });
});

describe("Dialect abstract members", () => {
    test("buildKnexConfig throws on the base class", () => {
        const d = new Dialect({ type: "x" });
        assert.throws(() => d.buildKnexConfig({}), /not implemented/);
    });
});
