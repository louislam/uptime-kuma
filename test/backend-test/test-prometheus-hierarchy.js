const { describe, test } = require("node:test");
const assert = require("node:assert");
const Monitor = require("../../server/model/monitor");

/**
 * Tests for monitor_parent_id and monitor_path_ids Prometheus labels.
 * Related issue: https://github.com/louislam/uptime-kuma/issues/3905
 */
describe("Monitor Prometheus hierarchy labels", () => {

    function makeMonitorStub(id, parentId = null) {
        return { id, parent: parentId };
    }

    function stubGetParent(parentMap) {
        const original = Monitor.getParent;
        Monitor.getParent = async (monitorID) => parentMap.get(monitorID) ?? null;
        return original;
    }

    test("getAllPathIDs returns /id/ for a root-level monitor", async () => {
        const original = stubGetParent(new Map([[5, null]]));
        try {
            const path = await Monitor.getAllPathIDs(5);
            assert.strictEqual(path, "/5/");
        } finally {
            Monitor.getParent = original;
        }
    });

    test("getAllPathIDs returns /parentId/childId/ for single-level nested monitor", async () => {
        const original = stubGetParent(new Map([[9, { id: 4 }], [4, null]]));
        try {
            const path = await Monitor.getAllPathIDs(9);
            assert.strictEqual(path, "/4/9/");
        } finally {
            Monitor.getParent = original;
        }
    });

    test("getAllPathIDs builds full path for deeply nested monitor", async () => {
        const original = stubGetParent(new Map([[20, { id: 10 }], [10, { id: 5 }], [5, null]]));
        try {
            const path = await Monitor.getAllPathIDs(20);
            assert.strictEqual(path, "/5/10/20/");
        } finally {
            Monitor.getParent = original;
        }
    });

    test("getAllPathIDs places root group first in path", async () => {
        const original = stubGetParent(new Map([[3, { id: 2 }], [2, { id: 1 }], [1, null]]));
        try {
            const path = await Monitor.getAllPathIDs(3);
            assert.strictEqual(path, "/1/2/3/");
        } finally {
            Monitor.getParent = original;
        }
    });

    test("monitor_parent_id is empty string for root-level monitor", () => {
        const monitor = makeMonitorStub(7, null);
        assert.strictEqual(monitor.parent || "", "");
    });

    test("monitor_parent_id equals parent id for nested monitor", () => {
        const monitor = makeMonitorStub(9, 4);
        assert.strictEqual(monitor.parent || "", 4);
    });

    test("monitor_path_ids falls back to /id/ when pathIds not set", () => {
        const monitor = makeMonitorStub(7);
        assert.strictEqual(monitor.pathIds || `/${monitor.id}/`, "/7/");
    });

    test("monitor_path_ids uses precomputed pathIds when available", () => {
        const monitor = makeMonitorStub(9, 4);
        monitor.pathIds = "/1/4/9/";
        assert.strictEqual(monitor.pathIds || `/${monitor.id}/`, "/1/4/9/");
    });
});
