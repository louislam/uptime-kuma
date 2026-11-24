import { afterEach, describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

// Heartbeats are stored as UTC wall-clock strings. Run the file in a non-UTC zone so a
// regression to `dayjs(heartbeat.time)` shifts the timestamps and fails this test.
process.env.TZ = "Europe/Rome";

const require = createRequire(import.meta.url);
const Database = require("../../server/database");
const { Settings } = require("../../server/settings");
const { UptimeCalculator } = require("../../server/uptime-calculator");
const { R } = require("redbean-node");

const originals = {
    getAll: R.getAll,
    getRow: R.getRow,
    settingsGet: Settings.get,
    settingsSet: Settings.set,
    clearHeartbeatData: Database.clearHeartbeatData,
    update: UptimeCalculator.prototype.update,
};

afterEach(() => {
    R.getAll = originals.getAll;
    R.getRow = originals.getRow;
    Settings.get = originals.settingsGet;
    Settings.set = originals.settingsSet;
    Database.clearHeartbeatData = originals.clearHeartbeatData;
    UptimeCalculator.prototype.update = originals.update;
});

describe("Database.migrateAggregateTable()", () => {
    test("reads heartbeat times as UTC, not as local time (#8217)", async () => {
        const seen: any[] = [];

        R.getAll = async (sql: string) => {
            if (sql.includes("DISTINCT monitor_id")) {
                return [{ monitor_id: 42 }];
            }
            if (sql.includes("DISTINCT DATE(time)")) {
                return [{ date: "2026-11-17" }];
            }
            if (sql.includes("SELECT status, ping, time")) {
                return [
                    { status: 1, ping: 12.5, time: "2026-11-17 00:30:00" },
                    { status: 0, ping: 0, time: "2026-11-17 23:30:00" },
                ];
            }
            throw new Error(`Unexpected query: ${sql}`);
        };
        R.getRow = async () => ({ count: 0 });
        Settings.get = async () => undefined;
        Settings.set = async () => {};
        Database.clearHeartbeatData = async () => {};
        UptimeCalculator.prototype.update = async (status: number, ping: number, date: any) => {
            seen.push(date);
            return date;
        };

        await Database.migrateAggregateTable();

        assert.strictEqual(seen.length, 2);
        // 00:30 and 23:30 on the same UTC day, whatever the host time zone is.
        assert.strictEqual(seen[0].valueOf(), Date.UTC(2026, 10, 17, 0, 30, 0));
        assert.strictEqual(seen[1].valueOf(), Date.UTC(2026, 10, 17, 23, 30, 0));
    });
});
