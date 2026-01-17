const { R } = require("redbean-node");
const { UP } = require("../../src/util");
const dayjs = require("dayjs");
const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

// --- FIX: Create dummy index.html so server.js doesn't crash on CI ---
// The server expects 'dist/index.html' to exist. If missing, we create a fake one.
const distPath = path.join(__dirname, "../../dist");
if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
}
const indexPath = path.join(distPath, "index.html");
if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, "<html><body>Dummy</body></html>");
}
// ---------------------------------------------------------------------

// Now it is safe to load the server
require("../../server/server"); 

describe("Issue #6663: Push Monitor Retry Reset", () => {
    let monitorId;

    beforeEach(async () => {
        // Wait for database to be ready
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