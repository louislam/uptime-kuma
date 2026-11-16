import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ManualMonitorType } = require("../../server/monitor-types/manual");
const { UP, DOWN, PENDING } = require("../../src/util");

/**
 * Run the manual monitor type check
 * @param {number|null} manualStatus Manual status
 * @returns {Promise<object>} Heartbeat result
 */
async function check(manualStatus) {
    const monitorType = new ManualMonitorType();
    const heartbeat = {};
    await monitorType.check({ manual_status: manualStatus }, heartbeat);
    return heartbeat;
}

describe("ManualMonitorType", () => {
    test("check() reports up when the manual status is up", async () => {
        const heartbeat = await check(UP);

        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Up");
    });

    test("check() reports down when the manual status is down", async () => {
        const heartbeat = await check(DOWN);

        assert.strictEqual(heartbeat.status, DOWN);
        assert.strictEqual(heartbeat.msg, "Down");
    });

    test("check() reports the manual status with a pending message for other statuses", async () => {
        const heartbeat = await check(3);

        assert.strictEqual(heartbeat.status, 3);
        assert.strictEqual(heartbeat.msg, "Pending");
    });

    test("check() reports pending when no manual status is set", async () => {
        const heartbeat = await check(null);

        assert.strictEqual(heartbeat.status, PENDING);
        assert.strictEqual(heartbeat.msg, "Manual monitoring - No status set");
    });
});
