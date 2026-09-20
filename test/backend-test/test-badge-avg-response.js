const { describe, test, mock } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const { UptimeCalculator } = require("../../server/uptime-calculator");

const router = require("../../server/routers/api-router");

/**
 * Get the avg-response route handler from the router stack
 * @returns {Function} Express route handler
 */
function getAvgResponseHandler() {
    for (const layer of router.stack) {
        if (layer.route && layer.route.path === "/api/badge/:id/avg-response/:duration?") {
            return layer.route.stack[layer.route.stack.length - 1].handle;
        }
    }
    throw new Error("avg-response route not found");
}

/**
 * Invoke the avg-response handler with mocked request/response
 * @param {object} params Route params
 * @param {object} query Query params
 * @returns {Promise<string>} SVG body sent by the handler
 */
async function invokeHandler(params, query = {}) {
    const res = {
        type: () => {},
        send: () => {},
        header: () => {},
    };
    const sent = [];
    res.send = (body) => sent.push(body);
    await getAvgResponseHandler()({ params, query }, res);
    return sent.join("");
}

describe("GET /api/badge/:id/avg-response/:duration?", () => {
    test("returns N/A for private monitor and skips UptimeCalculator", async () => {
        const mockGetUptimeCalculator = mock.method(UptimeCalculator, "getUptimeCalculator", async () => {
            throw new Error("should not be called");
        });
        mock.method(R, "getRow", async () => null);

        try {
            const svg = await invokeHandler({ id: "1", duration: "24" });
            assert.match(svg, /N\/A/);
            assert.strictEqual(mockGetUptimeCalculator.mock.calls.length, 0);
        } finally {
            mock.restoreAll();
        }
    });

    test("returns avg response value for public monitor with data", async () => {
        mock.method(R, "getRow", async () => ({ monitor_id: 1 }));
        mock.method(UptimeCalculator, "getUptimeCalculator", async () => ({
            getDataByDuration: () => ({ avgPing: 123.456 }),
        }));

        try {
            const svg = await invokeHandler({ id: "1", duration: "24" });
            assert.match(svg, /123/);
            assert.doesNotMatch(svg, /N\/A/);
        } finally {
            mock.restoreAll();
        }
    });

    test("returns N/A for public monitor without data", async () => {
        mock.method(R, "getRow", async () => ({ monitor_id: 1 }));
        mock.method(UptimeCalculator, "getUptimeCalculator", async () => ({
            getDataByDuration: () => ({ avgPing: null }),
        }));

        try {
            const svg = await invokeHandler({ id: "1", duration: "24" });
            assert.match(svg, /N\/A/);
        } finally {
            mock.restoreAll();
        }
    });
});
