const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { normalizeNtripConfig } = require("../../server/ntrip/config");

const MIGRATION_NAME = "2026-09-07-0000-add-ntrip-monitor.js";
const MIGRATION_DIRECTORY = path.join(__dirname, "../../db/knex_migrations");

const NTRIP_COLUMNS = [
    "ntrip_tls",
    "ntrip_mountpoint",
    "ntrip_revision",
    "ntrip_username",
    "ntrip_password",
    "ntrip_handshake_timeout",
    "ntrip_initial_timeout",
    "ntrip_stale_timeout",
    "ntrip_gga_enabled",
    "ntrip_latitude",
    "ntrip_longitude",
    "ntrip_altitude_msl",
    "ntrip_gga_interval",
];

/**
 * Run a callback against a throwaway migrated SQLite database.
 *
 * MariaDB is not covered here on purpose: `test-migration.js` already runs every
 * migration in the directory against a MariaDB container, so this migration is
 * exercised there without duplicating the container plumbing.
 * @param {string} label Suffix for the temporary database file
 * @param {Function} callback Receives the connected redbean instance
 * @returns {Promise<void>} Resolves once the database has been torn down
 */
async function withMigratedDatabase(label, callback) {
    const testDbPath = path.join(__dirname, `../../data/test-ntrip-migration-${label}.db`);
    const testDbDir = path.dirname(testDbPath);

    if (!fs.existsSync(testDbDir)) {
        fs.mkdirSync(testDbDir, { recursive: true });
    }
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }

    // Use the same SQLite driver as the project
    const knex = require("knex");
    const db = knex({
        client: "better-sqlite3",
        connection: { filename: testDbPath },
        useNullAsDefault: true,
    });

    const { R } = require("redbean-node");
    R.setup(db);

    try {
        const { createTables } = require("../../db/knex_init_db.js");
        await createTables();
        await R.knex.migrate.latest({ directory: MIGRATION_DIRECTORY });
        await callback(R);
    } finally {
        await R.knex.destroy();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    }
}

/**
 * Dispense a monitor bean carrying the fields every monitor row needs.
 * @param {object} R Connected redbean instance
 * @param {object} fields Extra fields to apply
 * @returns {object} Unsaved monitor bean
 */
function dispenseMonitor(R, fields) {
    const bean = R.dispense("monitor");
    bean.name = "NTRIP caster";
    bean.type = "ntrip";
    bean.active = 1;
    bean.interval = 60;
    bean.retryInterval = 60;
    bean.maxretries = 0;
    for (const [key, value] of Object.entries(fields)) {
        bean[key] = value;
    }
    return bean;
}

/**
 * Build the preload data `Monitor.toJSON()` expects, with empty values.
 * @param {number} monitorID Monitor the maps should answer for
 * @returns {object} Preload data
 */
function emptyPreloadData(monitorID) {
    const empty = (value) => new Map([[monitorID, value]]);
    return {
        paths: empty(["NTRIP caster"]),
        childrenIDs: empty([]),
        activeStatus: empty(true),
        forceInactive: empty(false),
        notifications: empty({}),
        tags: empty([]),
        maintenanceStatus: empty(false),
    };
}

describe("NTRIP monitor migration", () => {
    test("adds every NTRIP column and round-trips a full configuration", async () => {
        await withMigratedDatabase("full", async (R) => {
            for (const column of NTRIP_COLUMNS) {
                assert.equal(
                    await R.knex.schema.hasColumn("monitor", column),
                    true,
                    `expected column ${column} to exist`
                );
            }

            // Saved in the camelCase the socket handlers use, read back in the
            // snake_case the database actually stores.
            const bean = dispenseMonitor(R, {
                hostname: "caster.example.test",
                port: 2102,
                ntripTls: true,
                ntripMountpoint: "BASE1",
                ntripRevision: "1",
                ntripUsername: "rover",
                ntripPassword: "s3cret",
                ntripHandshakeTimeout: 5,
                ntripInitialTimeout: 45,
                ntripStaleTimeout: 90,
                ntripGgaEnabled: true,
                ntripLatitude: 51.4779273,
                ntripLongitude: -0.0014863,
                ntripAltitudeMsl: 45.25,
                ntripGgaInterval: 20,
            });
            const monitorID = await R.store(bean);

            const row = await R.knex("monitor").where("id", monitorID).first();
            assert.equal(row.ntrip_mountpoint, "BASE1");
            assert.equal(row.ntrip_revision, "1");
            assert.equal(row.ntrip_username, "rover");
            assert.equal(row.ntrip_password, "s3cret");
            assert.equal(row.ntrip_handshake_timeout, 5);
            assert.equal(row.ntrip_initial_timeout, 45);
            assert.equal(row.ntrip_stale_timeout, 90);
            assert.equal(row.ntrip_gga_interval, 20);
            assert.equal(Boolean(row.ntrip_tls), true);
            assert.equal(Boolean(row.ntrip_gga_enabled), true);
            assert.equal(Number(row.ntrip_latitude), 51.4779273);
            assert.equal(Number(row.ntrip_longitude), -0.0014863);
            assert.equal(Number(row.ntrip_altitude_msl), 45.25);

            // The stored row must be usable by the session without further translation.
            const stored = await R.findOne("monitor", " id = ? ", [monitorID]);
            const config = normalizeNtripConfig(stored);
            assert.deepEqual(config, {
                hostname: "caster.example.test",
                port: 2102,
                tls: true,
                mountpoint: "BASE1",
                revision: "1",
                username: "rover",
                password: "s3cret",
                handshakeTimeoutMs: 5000,
                initialTimeoutMs: 45000,
                staleTimeoutMs: 90000,
                gga: {
                    latitude: 51.4779273,
                    longitude: -0.0014863,
                    altitudeMsl: 45.25,
                    intervalMs: 20000,
                },
            });
        });
    });

    test("leaves unset NTRIP settings at their documented defaults", async () => {
        await withMigratedDatabase("defaults", async (R) => {
            const bean = dispenseMonitor(R, { hostname: "caster.example.test" });
            const monitorID = await R.store(bean);

            const row = await R.knex("monitor").where("id", monitorID).first();
            assert.equal(Boolean(row.ntrip_tls), false);
            assert.equal(Boolean(row.ntrip_gga_enabled), false);
            assert.equal(row.ntrip_handshake_timeout, 15);
            assert.equal(row.ntrip_initial_timeout, 30);
            assert.equal(row.ntrip_stale_timeout, 30);
            assert.equal(row.ntrip_gga_interval, 10);
            assert.equal(row.ntrip_mountpoint, null);
            assert.equal(row.ntrip_revision, null);
            assert.equal(row.ntrip_username, null);
            assert.equal(row.ntrip_password, null);
            assert.equal(row.ntrip_latitude, null);
            assert.equal(row.ntrip_longitude, null);
            assert.equal(row.ntrip_altitude_msl, null);
        });
    });

    test("serializes credentials and coordinates only for authenticated clients", async () => {
        await withMigratedDatabase("serialization", async (R) => {
            await R.autoloadModels("./server/model");

            const bean = dispenseMonitor(R, {
                hostname: "caster.example.test",
                port: 2102,
                ntripTls: true,
                ntripMountpoint: "BASE1",
                ntripRevision: "2",
                ntripUsername: "rover",
                ntripPassword: "s3cret",
                ntripHandshakeTimeout: 5,
                ntripInitialTimeout: 45,
                ntripStaleTimeout: 90,
                ntripGgaEnabled: true,
                ntripLatitude: 51.4779273,
                ntripLongitude: -0.0014863,
                ntripAltitudeMsl: 45.25,
                ntripGgaInterval: 20,
                accepted_statuscodes_json: '["200-299"]',
            });
            const monitorID = await R.store(bean);

            const monitor = await R.findOne("monitor", " id = ? ", [monitorID]);
            const preloadData = emptyPreloadData(monitorID);

            const privateJSON = monitor.toJSON(preloadData, true);
            assert.equal(privateJSON.ntripMountpoint, "BASE1");
            assert.equal(privateJSON.ntripRevision, "2");
            assert.equal(privateJSON.ntripTls, true);
            assert.equal(privateJSON.ntripGgaEnabled, true);
            assert.equal(privateJSON.ntripHandshakeTimeout, 5);
            assert.equal(privateJSON.ntripInitialTimeout, 45);
            assert.equal(privateJSON.ntripStaleTimeout, 90);
            assert.equal(privateJSON.ntripGgaInterval, 20);
            assert.equal(privateJSON.ntripUsername, "rover");
            assert.equal(privateJSON.ntripPassword, "s3cret");
            assert.equal(privateJSON.ntripLatitude, 51.4779273);
            assert.equal(privateJSON.ntripLongitude, -0.0014863);
            assert.equal(privateJSON.ntripAltitudeMsl, 45.25);

            const sharedJSON = monitor.toJSON(preloadData, false);
            assert.equal(sharedJSON.ntripMountpoint, "BASE1");
            assert.equal(sharedJSON.ntripGgaEnabled, true);
            assert.equal("ntripUsername" in sharedJSON, false);
            assert.equal("ntripPassword" in sharedJSON, false);
            assert.equal("ntripLatitude" in sharedJSON, false);
            assert.equal("ntripLongitude" in sharedJSON, false);
            assert.equal("ntripAltitudeMsl" in sharedJSON, false);

            const publicJSON = await monitor.toPublicJSON();
            const publicText = JSON.stringify(publicJSON);
            assert.equal(publicText.includes("s3cret"), false);
            assert.equal(publicText.includes("rover"), false);
            assert.equal(publicText.includes("51.47"), false);
            assert.equal(publicText.includes("-0.0014"), false);
        });
    });

    test("rejects an invalid NTRIP monitor without echoing the password", async () => {
        await withMigratedDatabase("validation", async (R) => {
            await R.autoloadModels("./server/model");

            const bean = dispenseMonitor(R, {
                hostname: "caster.example.test",
                ntripMountpoint: "BASE\r\nX: y",
                ntripPassword: "s3cret",
            });

            assert.throws(
                () => bean.validate(),
                (error) => {
                    assert.match(error.message, /mountpoint/);
                    assert.equal(error.message.includes("s3cret"), false);
                    return true;
                }
            );
        });
    });

    test("rolls back every NTRIP column", async () => {
        await withMigratedDatabase("rollback", async (R) => {
            await R.knex.migrate.down({
                directory: MIGRATION_DIRECTORY,
                name: MIGRATION_NAME,
            });

            for (const column of NTRIP_COLUMNS) {
                assert.equal(
                    await R.knex.schema.hasColumn("monitor", column),
                    false,
                    `expected column ${column} to be dropped`
                );
            }
        });
    });

    test("re-applies over a partially migrated table instead of failing", async () => {
        await withMigratedDatabase("partial", async (R) => {
            // Reproduces an interrupted first run: some columns landed, the
            // migration record did not. Recovery previously meant hand-editing
            // the database, so the retry has to be the repair.
            await R.knex.schema.alterTable("monitor", (table) => {
                table.dropColumn("ntrip_gga_interval");
                table.dropColumn("ntrip_altitude_msl");
            });
            await R.knex("knex_migrations").where("name", MIGRATION_NAME).delete();

            await R.knex.migrate.latest({ directory: MIGRATION_DIRECTORY });

            for (const column of NTRIP_COLUMNS) {
                assert.equal(
                    await R.knex.schema.hasColumn("monitor", column),
                    true,
                    `expected column ${column} to be restored`
                );
            }
        });
    });

    test("rolling back twice is not an error", async () => {
        await withMigratedDatabase("rollback-twice", async (R) => {
            const down = () =>
                R.knex.migrate.down({
                    directory: MIGRATION_DIRECTORY,
                    name: MIGRATION_NAME,
                });

            await down();
            await R.knex("knex_migrations").insert({
                name: MIGRATION_NAME,
                batch: 1,
                migration_time: new Date(),
            });

            await down();

            assert.equal(await R.knex.schema.hasColumn("monitor", "ntrip_tls"), false);
        });
    });
});
