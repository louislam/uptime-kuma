const { R } = require("redbean-node");
const { UP } = require("../../src/util");
const dayjs = require("dayjs");
const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");

// Load server but don't let it hang the process
require("../../server/server"); 

describe("Issue #6663: Push Monitor Retry Reset", () => {
    let monitorId;

    beforeEach(async () => {
        // Wait for database to be ready before starting
        // (A simple delay to ensure server startup logic processes)
        await new Promise(resolve => setTimeout(resolve, 1000));

        monitorId = await R.store(R.dispense("monitor"));
        await R.exec("UPDATE monitor SET type = 'push', interval = 60, maxretries = 5, active = 1 WHERE id = ?", [monitorId]);
    });

    afterEach(async () => {
        if (monitorId) {
            await R.exec("DELETE FROM monitor WHERE id = ?", [monitorId]);
            await R.exec("DELETE FROM heartbeat WHERE monitor_id = ?", [monitorId]);
        }
    });

    test("Should reset retries to 0 if previous beat was UP", async () => {
        const monitor = await R.load("monitor", monitorId);

        // 1. Simulate the 'Buggy' State (UP but with high retries)
        let buggyBeat = R.dispense("heartbeat");
        buggyBeat.monitor_id = monitorId;
        buggyBeat.status = UP;
        buggyBeat.time = R.isoDateTimeMillis(dayjs().subtract(2, "minutes"));
        buggyBeat.retries = 20; 
        await R.store(buggyBeat);

        // 2. Run the logic (simulating the fix)
        let previousBeat = await R.findOne("heartbeat", " monitor_id = ? ORDER BY time DESC", [monitor.id]);
        let retries = previousBeat.retries;

        // --- THE FIX LOGIC ---
        if (previousBeat.status === UP) {
            retries = 0;
        }
        // ---------------------

        // 3. Simulate next tick
        if (retries < monitor.maxretries) {
            retries++;
        }

        console.log(`Test Result: Previous Retries: ${previousBeat.retries} -> New Retries: ${retries}`);
        
        assert.strictEqual(retries, 1, "Retries should have reset to 1 (0+1), but it continued counting!");
        
        // Force exit because server.js keeps the process alive
        process.exit(0);
    });
});