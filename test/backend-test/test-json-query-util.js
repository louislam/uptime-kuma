const { describe, test } = require("node:test");
const assert = require("node:assert");

const { evaluateJsonQuery } = require("../../src/util");

describe("JSON query utility", () => {
    test("evaluates JSONata paths and comparisons through the shared utility", async () => {
        const result = await evaluateJsonQuery(
            JSON.stringify({
                monitor: {
                    status: "up",
                    latency: 42,
                },
            }),
            "monitor.latency",
            ">=",
            40
        );

        assert.deepStrictEqual(result, {
            status: true,
            response: 42,
        });
    });
});
