const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const knexLib = require("knex");

const {
    Dialect,
    SqliteDialect,
    MariadbDialect,
    EmbeddedMariadbDialect,
    PostgresDialect,
} = require("../../server/dialects");

/**
 * Tests that the dialect SQL fragments stay portable. For dialects we cannot
 * spin up here (PG/MariaDB) we only check the emitted string. For SQLite we
 * also execute the fragment against an in-memory DB to prove it runs.
 */

describe("Dialect.sqlDateFromColumn() string output", () => {
    test("base Dialect throws (abstract)", () => {
        const d = new Dialect({ type: "x" });
        assert.throws(() => d.sqlDateFromColumn("time"), /not implemented/);
    });

    test("SQLite emits DATE(col)", () => {
        const d = new SqliteDialect({ type: "sqlite" });
        assert.strictEqual(d.sqlDateFromColumn("time"), "DATE(time)");
    });

    test("MariaDB emits DATE(col)", () => {
        const d = new MariadbDialect({ type: "mariadb" });
        assert.strictEqual(d.sqlDateFromColumn("time"), "DATE(time)");
    });

    test("EmbeddedMariadb inherits MariaDB behavior", () => {
        const d = new EmbeddedMariadbDialect({ type: "embedded-mariadb" });
        assert.strictEqual(d.sqlDateFromColumn("time"), "DATE(time)");
    });

    test("PostgreSQL casts via ::date (no DATE() builtin)", () => {
        const d = new PostgresDialect({ type: "postgres" });
        assert.strictEqual(d.sqlDateFromColumn("time"), "(time)::date");
    });

    test("supports arbitrary column expressions for all dialects", () => {
        const sqlite = new SqliteDialect({ type: "sqlite" });
        const maria = new MariadbDialect({ type: "mariadb" });
        const pg = new PostgresDialect({ type: "postgres" });
        assert.strictEqual(sqlite.sqlDateFromColumn("h.time"), "DATE(h.time)");
        assert.strictEqual(maria.sqlDateFromColumn("h.time"), "DATE(h.time)");
        assert.strictEqual(pg.sqlDateFromColumn("h.time"), "(h.time)::date");
    });
});

describe("Dialect.sqlDateFromColumn() executes against SQLite", () => {
    const os = require("os");
    const dbPath = path.join(os.tmpdir(), "uptime-kuma-test-dialect-portability.db");
    let knex;

    before(async () => {
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
        const KnexDialect = require("knex/lib/dialects/sqlite3/index.js");
        KnexDialect.prototype._driver = () => require("@louislam/sqlite3");
        knex = knexLib({
            client: KnexDialect,
            connection: { filename: dbPath },
            useNullAsDefault: true,
        });
        await knex.schema.createTable("hb_test", (t) => {
            t.increments("id");
            t.integer("monitor_id");
            t.string("time");
        });
        await knex("hb_test").insert([
            { monitor_id: 1,
                time: "2024-06-15 12:00:00" },
            { monitor_id: 1,
                time: "2024-06-15 23:59:59" },
            { monitor_id: 1,
                time: "2024-06-16 00:00:01" },
            { monitor_id: 2,
                time: "2024-06-15 09:00:00" },
        ]);
    });

    after(async () => {
        if (knex) {
            await knex.destroy();
        }
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
    });

    test("SQLite DATE() groups heartbeats by calendar day", async () => {
        const d = new SqliteDialect({ type: "sqlite" });
        const dateExpr = d.sqlDateFromColumn("time");
        const result = await knex.raw(
            `SELECT DISTINCT ${dateExpr} AS d FROM hb_test WHERE monitor_id = ? ORDER BY d ASC`,
            [ 1 ]
        );
        const rows = Array.isArray(result) ? result : (result.rows || []);
        const dates = rows.map((r) => r.d);
        assert.deepStrictEqual(dates, [ "2024-06-15", "2024-06-16" ]);
    });

    test("SQLite DATE() filters heartbeats by a specific day", async () => {
        const d = new SqliteDialect({ type: "sqlite" });
        const dateExpr = d.sqlDateFromColumn("time");
        const result = await knex.raw(
            `SELECT COUNT(*) AS c FROM hb_test WHERE monitor_id = ? AND ${dateExpr} = ?`,
            [ 1, "2024-06-15" ]
        );
        const rows = Array.isArray(result) ? result : (result.rows || []);
        assert.strictEqual(Number(rows[0].c), 2);
    });
});

describe("Dialect.sqlHourOffset() string output (regression guard)", () => {
    test("SQLite", () => {
        const d = new SqliteDialect({ type: "sqlite" });
        assert.strictEqual(d.sqlHourOffset(), "DATETIME('now', ? || ' hours')");
    });

    test("MariaDB", () => {
        const d = new MariadbDialect({ type: "mariadb" });
        assert.strictEqual(d.sqlHourOffset(), "DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR)");
    });

    test("PostgreSQL", () => {
        const d = new PostgresDialect({ type: "postgres" });
        assert.strictEqual(d.sqlHourOffset(), "(NOW() AT TIME ZONE 'UTC') + (? || ' hours')::interval");
    });
});
