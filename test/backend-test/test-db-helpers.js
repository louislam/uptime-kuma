const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

describe("db.js singleton", () => {
    // Reload via decache so each test starts fresh
    /**
     * @returns {object} Fresh server/db module (cache-busted)
     */
    function freshDb() {
        delete require.cache[require.resolve("../../server/db")];
        return require("../../server/db");
    }

    test("getKnex throws before setupKnex is called", () => {
        const { getKnex } = freshDb();
        assert.throws(() => getKnex(), /Knex not initialized/);
    });

    test("setupKnex stores instance and binds Objection", () => {
        const { setupKnex, getKnex } = freshDb();
        const knex = require("knex");

        const dbPath = path.join(__dirname, "../../data/test-db-helpers.db");
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }

        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => require("@louislam/sqlite3");

        const instance = knex({
            client: Dialect,
            connection: { filename: dbPath },
            useNullAsDefault: true,
        });
        setupKnex(instance);
        assert.strictEqual(getKnex(), instance);

        // Objection.Model should be bound to the instance
        const { Model } = require("objection");
        assert.strictEqual(Model.knex(), instance);

        return instance.destroy().then(() => {
            if (fs.existsSync(dbPath)) {
                fs.unlinkSync(dbPath);
            }
        });
    });

    test("destroyKnex tears down and resets singleton", async () => {
        const { setupKnex, destroyKnex, getKnex } = freshDb();
        const knex = require("knex");

        const dbPath = path.join(__dirname, "../../data/test-db-helpers-2.db");
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }

        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => require("@louislam/sqlite3");

        const instance = knex({
            client: Dialect,
            connection: { filename: dbPath },
            useNullAsDefault: true,
        });
        setupKnex(instance);
        await destroyKnex();
        assert.throws(() => getKnex(), /Knex not initialized/);

        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
    });
});

describe("iso-datetime helpers", () => {
    const { isoDateTime, isoDateTimeMillis, SQL_DATETIME_FORMAT, SQL_DATETIME_FORMAT_MS } = require("../../server/utils/iso-datetime");
    const dayjs = require("dayjs");
    const utc = require("dayjs/plugin/utc");
    dayjs.extend(utc);

    test("isoDateTimeMillis formats with ms precision", () => {
        const out = isoDateTimeMillis(dayjs.utc("2024-06-15T12:34:56.123Z"));
        assert.strictEqual(out, "2024-06-15 12:34:56.123");
    });

    test("isoDateTime drops milliseconds", () => {
        const out = isoDateTime(dayjs.utc("2024-06-15T12:34:56.789Z"));
        assert.strictEqual(out, "2024-06-15 12:34:56");
    });

    test("format constants match expected SQL formats", () => {
        assert.strictEqual(SQL_DATETIME_FORMAT, "YYYY-MM-DD HH:mm:ss");
        assert.strictEqual(SQL_DATETIME_FORMAT_MS, "YYYY-MM-DD HH:mm:ss.SSS");
    });

    test("isoDateTimeMillis accepts a Date instance", () => {
        const out = isoDateTimeMillis(new Date("2024-06-15T12:34:56.789Z"));
        assert.strictEqual(out, "2024-06-15 12:34:56.789");
    });

    test("isoDateTime accepts a Date instance", () => {
        const out = isoDateTime(new Date("2024-06-15T12:34:56.789Z"));
        assert.strictEqual(out, "2024-06-15 12:34:56");
    });

    test("isoDateTime returns now() when called without args", () => {
        const out = isoDateTime();
        assert.match(out, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
});

