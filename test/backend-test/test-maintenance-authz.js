// Cross-user authorization regression tests for the maintenance socket handler.
//
// Background: PR #20 (H-7 cross-user permission test suite) surfaced four
// handlers that operated on any maintenance ID without checking the caller
// owned the row:
//   - pauseMaintenance
//   - resumeMaintenance
//   - addMonitorMaintenance
//   - addMaintenanceStatusPage
//
// editMaintenance already enforces `bean.user_id === socket.userID`. This
// suite asserts the same check is now applied to the four handlers above:
// Bob cannot mutate Alice's maintenance, but Alice still can.
//
// We exercise the handlers directly (no real socket.io / HTTP) by:
//   1. Bringing up an in-memory sqlite DB via the standard TestDB harness.
//   2. Stubbing `UptimeKumaServer.io` so handlers calling `sendMaintenanceList`
//      don't crash (the production server boot wires the real one).
//   3. Capturing the handler functions registered on a fake socket and
//      invoking them with a callback that records `{ ok, msg }`.

// Constructing UptimeKumaServer via getInstance() reads ./dist/index.html and
// process.exits when missing in non-development mode. The test harness runs
// from a fresh checkout where dist/ has not been built, so flag development.
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server", "info_maintenance", "debug_maintenance"].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");

// Maintenance.run() / generateCron() / toJSON() reach into dayjs plugins that
// server.js registers at boot. The test harness skips server.js, so we
// register them here too — same pattern as test-maintenance.js.
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("../../server/modules/dayjs/plugin/timezone"));
dayjs.extend(require("dayjs/plugin/customParseFormat"));

const TestDB = require("../mock-testdb");
const { Settings } = require("../../server/settings");
const { getKnex } = require("../../server/db");
const Maintenance = require("../../server/model/maintenance");
const { UptimeKumaServer } = require("../../server/uptime-kuma-server");
const { maintenanceSocketHandler } = require("../../server/socket-handlers/maintenance-socket-handler");

const testDb = new TestDB("./data/test-maintenance-authz");

/**
 * Build a manual-strategy maintenance row owned by `userId`. Manual strategy
 * is used because Maintenance.run()/stop() are no-ops for it (no real cron
 * jobs scheduled), so the pause/resume code paths are safe to drive in-test.
 * @param {number} userId Owning user
 * @param {string} title Title for the row
 * @returns {object} Insert payload for `Maintenance.query().insert(...)`
 */
function maintenancePayload(userId, title) {
    return {
        title,
        description: "authz test fixture",
        user_id: userId,
        active: true,
        strategy: "manual",
        start_date: null,
        end_date: null,
        start_time: null,
        end_time: null,
        weekdays: "[]",
        days_of_month: "[]",
        interval_day: null,
        timezone: "UTC",
        cron: null,
        duration: null,
    };
}

/**
 * Build a fake socket that just records handlers registered via socket.on.
 * Mirrors the bare minimum the real handler module touches: `userID`,
 * `on(name, fn)`, plus a no-op `emit` so `server.io.to(...).emit(...)` is safe.
 * @param {number} userID The acting user
 * @returns {object} { socket, handlers }
 */
function makeFakeSocket(userID) {
    const handlers = {};
    const socket = {
        userID,
        on(name, fn) {
            handlers[name] = fn;
        },
        emit() {},
    };
    return { socket,
        handlers };
}

/**
 * Drive a captured handler and resolve with the callback payload.
 * @param {Function} handler The captured `socket.on` callback
 * @param {Array} args Arguments before the trailing callback
 * @returns {Promise<object>} The `{ ok, msg, ... }` callback object
 */
function invokeHandler(handler, args) {
    return new Promise((resolve) => {
        handler(...args, (result) => resolve(result));
    });
}

describe("Maintenance socket handler — cross-user authorization", () => {
    let aliceId;
    let bobId;
    let aliceMaintenanceId;
    let aliceMonitorId;
    let aliceStatusPageId;

    before(async () => {
        await testDb.create();

        // Stub server.io so sendMaintenanceList(socket) → io.to(userID).emit(...) is a no-op.
        const server = UptimeKumaServer.getInstance();
        server.io = {
            to: () => ({ emit: () => {} }),
        };

        const knex = getKnex();

        // Two users. The user table requires a unique username; password is
        // unused by these handlers so a placeholder hash is fine.
        const [ aliceRow ] = await knex("user").insert({
            username: "alice-authz",
            password: "x",
            active: true,
        }).returning("id");
        aliceId = typeof aliceRow === "object" ? aliceRow.id : aliceRow;

        const [ bobRow ] = await knex("user").insert({
            username: "bob-authz",
            password: "x",
            active: true,
        }).returning("id");
        bobId = typeof bobRow === "object" ? bobRow.id : bobRow;

        // Alice owns one maintenance, one monitor, and one status page.
        const insertedMaintenance = await Maintenance.query().insert(
            maintenancePayload(aliceId, "alice-authz-maintenance")
        );
        aliceMaintenanceId = insertedMaintenance.id;

        // Hydrate it into server.maintenanceList so server.getMaintenance()
        // (used by pause/resumeMaintenance) returns the bean.
        const aliceBean = await Maintenance.query().findById(aliceMaintenanceId);
        server.maintenanceList[aliceMaintenanceId] = aliceBean;

        const [ aliceMonitorRow ] = await knex("monitor").insert({
            name: "alice-monitor",
            user_id: aliceId,
            active: true,
            interval: 60,
            type: "http",
            url: "https://example.com",
        }).returning("id");
        aliceMonitorId = typeof aliceMonitorRow === "object" ? aliceMonitorRow.id : aliceMonitorRow;

        const [ aliceStatusPageRow ] = await knex("status_page").insert({
            slug: "alice-authz-page",
            title: "Alice page",
            icon: "/icon.svg",
            theme: "light",
            published: true,
        }).returning("id");
        aliceStatusPageId = typeof aliceStatusPageRow === "object" ? aliceStatusPageRow.id : aliceStatusPageRow;
    });

    after(async () => {
        // Clear maintenanceList so other tests don't see leaked beans.
        const server = UptimeKumaServer.getInstance();
        for (const id of Object.keys(server.maintenanceList)) {
            const bean = server.maintenanceList[id];
            if (bean && typeof bean.stop === "function") {
                bean.stop();
            }
            delete server.maintenanceList[id];
        }
        Settings.stopCacheCleaner();
        await testDb.destroy();
    });

    /**
     * Register the maintenance handlers against a fresh fake socket for
     * `userID` and return the handler map for direct invocation.
     * @param {number} userID Acting user
     * @returns {object} Map of event name → handler
     */
    function handlersFor(userID) {
        const { socket, handlers } = makeFakeSocket(userID);
        maintenanceSocketHandler(socket);
        return handlers;
    }

    describe("Bob cannot mutate Alice's maintenance", () => {
        test("pauseMaintenance rejects with 'Permission denied.'", async () => {
            const bob = handlersFor(bobId);
            const result = await invokeHandler(bob.pauseMaintenance, [ aliceMaintenanceId ]);
            assert.strictEqual(result.ok, false, "Bob's pauseMaintenance must fail");
            assert.match(
                result.msg,
                /Permission denied\./,
                `expected permission-denied error, got: ${result.msg}`
            );

            // The bean must still be active in the in-memory list. SQLite
            // stores booleans as 1/0, so coerce before comparing.
            const server = UptimeKumaServer.getInstance();
            assert.ok(
                Boolean(server.maintenanceList[aliceMaintenanceId].active),
                "Bob's call must not have flipped active=false"
            );
        });

        test("resumeMaintenance rejects with 'Permission denied.'", async () => {
            // Make sure the bean is paused first so a successful resume would
            // be observable; we pause as Alice, then assert Bob can't resume.
            const alice = handlersFor(aliceId);
            const pauseResult = await invokeHandler(alice.pauseMaintenance, [ aliceMaintenanceId ]);
            assert.strictEqual(pauseResult.ok, true, "Alice should be able to pause her own maintenance");

            const bob = handlersFor(bobId);
            const result = await invokeHandler(bob.resumeMaintenance, [ aliceMaintenanceId ]);
            assert.strictEqual(result.ok, false, "Bob's resumeMaintenance must fail");
            assert.match(result.msg, /Permission denied\./);

            // Still paused after Bob's failed call.
            const server = UptimeKumaServer.getInstance();
            assert.ok(
                !server.maintenanceList[aliceMaintenanceId].active,
                "Bob's call must not have flipped active=true"
            );
        });

        test("addMonitorMaintenance rejects with 'Permission denied.' and does not write join rows", async () => {
            const bob = handlersFor(bobId);
            const result = await invokeHandler(bob.addMonitorMaintenance, [
                aliceMaintenanceId,
                [ { id: aliceMonitorId } ],
            ]);
            assert.strictEqual(result.ok, false, "Bob's addMonitorMaintenance must fail");
            assert.match(result.msg, /Permission denied\./);

            const rows = await getKnex()("monitor_maintenance")
                .where("maintenance_id", aliceMaintenanceId);
            assert.strictEqual(rows.length, 0, "join table must remain empty after Bob's failed call");
        });

        test("addMaintenanceStatusPage rejects with 'Permission denied.' and does not write join rows", async () => {
            const bob = handlersFor(bobId);
            const result = await invokeHandler(bob.addMaintenanceStatusPage, [
                aliceMaintenanceId,
                [ { id: aliceStatusPageId } ],
            ]);
            assert.strictEqual(result.ok, false, "Bob's addMaintenanceStatusPage must fail");
            assert.match(result.msg, /Permission denied\./);

            const rows = await getKnex()("maintenance_status_page")
                .where("maintenance_id", aliceMaintenanceId);
            assert.strictEqual(rows.length, 0, "join table must remain empty after Bob's failed call");
        });
    });

    describe("Alice can still mutate her own maintenance", () => {
        test("resumeMaintenance succeeds (re-activating the row paused above)", async () => {
            const alice = handlersFor(aliceId);
            const result = await invokeHandler(alice.resumeMaintenance, [ aliceMaintenanceId ]);
            assert.strictEqual(result.ok, true, `Alice's resumeMaintenance failed: ${result.msg}`);
            assert.strictEqual(result.msg, "successResumed");

            const server = UptimeKumaServer.getInstance();
            assert.ok(
                Boolean(server.maintenanceList[aliceMaintenanceId].active),
                "active flag must be true after Alice resumes"
            );
        });

        test("pauseMaintenance succeeds", async () => {
            const alice = handlersFor(aliceId);
            const result = await invokeHandler(alice.pauseMaintenance, [ aliceMaintenanceId ]);
            assert.strictEqual(result.ok, true, `Alice's pauseMaintenance failed: ${result.msg}`);
            assert.strictEqual(result.msg, "successPaused");

            const server = UptimeKumaServer.getInstance();
            assert.ok(
                !server.maintenanceList[aliceMaintenanceId].active,
                "active flag must be false after Alice pauses"
            );
        });

        test("addMonitorMaintenance succeeds and writes the join row", async () => {
            const alice = handlersFor(aliceId);
            const result = await invokeHandler(alice.addMonitorMaintenance, [
                aliceMaintenanceId,
                [ { id: aliceMonitorId } ],
            ]);
            assert.strictEqual(result.ok, true, `Alice's addMonitorMaintenance failed: ${result.msg}`);

            const rows = await getKnex()("monitor_maintenance")
                .where("maintenance_id", aliceMaintenanceId);
            assert.strictEqual(rows.length, 1, "exactly one join row should exist after Alice's call");
            assert.strictEqual(rows[0].monitor_id, aliceMonitorId);
        });

        test("addMaintenanceStatusPage succeeds and writes the join row", async () => {
            const alice = handlersFor(aliceId);
            const result = await invokeHandler(alice.addMaintenanceStatusPage, [
                aliceMaintenanceId,
                [ { id: aliceStatusPageId } ],
            ]);
            assert.strictEqual(result.ok, true, `Alice's addMaintenanceStatusPage failed: ${result.msg}`);

            const rows = await getKnex()("maintenance_status_page")
                .where("maintenance_id", aliceMaintenanceId);
            assert.strictEqual(rows.length, 1, "exactly one join row should exist after Alice's call");
            assert.strictEqual(rows[0].status_page_id, aliceStatusPageId);
        });
    });

    describe("Unknown maintenance ID is rejected (defense in depth)", () => {
        test("pauseMaintenance with an unknown id rejects", async () => {
            const alice = handlersFor(aliceId);
            const result = await invokeHandler(alice.pauseMaintenance, [ 999999 ]);
            assert.strictEqual(result.ok, false);
            assert.match(result.msg, /Permission denied\./);
        });

        test("addMonitorMaintenance with an unknown id rejects", async () => {
            const alice = handlersFor(aliceId);
            const result = await invokeHandler(alice.addMonitorMaintenance, [ 999999, [] ]);
            assert.strictEqual(result.ok, false);
            assert.match(result.msg, /Permission denied\./);
        });
    });
});
