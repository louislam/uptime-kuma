const { describe, test } = require("node:test");
const assert = require("node:assert");

const { Prometheus } = require("../../server/prometheus");

/**
 * Build a Prometheus instance without touching the database.
 * @param {Array<{name: string, value: ?string}>} tags Tags to map
 * @returns {Prometheus} instance
 */
function buildPrometheus(tags) {
    const monitor = {
        id: 1,
        name: "test monitor",
        type: "http",
        url: "https://example.com",
        hostname: null,
        port: null,
    };
    return new Prometheus(monitor, tags);
}

describe("Prometheus", () => {
    describe("mapTagsToLabels", () => {
        test("maps a tag with a value to that value", () => {
            const prometheus = buildPrometheus([{ name: "env", value: "production" }]);
            assert.deepStrictEqual(prometheus.monitorLabelValues.env, ["production"]);
        });

        test("name-only tag (no value) falls back to the tag name instead of being empty", () => {
            const prometheus = buildPrometheus([{ name: "production", value: null }]);
            assert.deepStrictEqual(prometheus.monitorLabelValues.production, ["production"]);
            assert.notDeepStrictEqual(prometheus.monitorLabelValues.production, []);
        });

        test("name-only tag with an empty string value also falls back to the tag name", () => {
            const prometheus = buildPrometheus([{ name: "critical", value: "" }]);
            assert.deepStrictEqual(prometheus.monitorLabelValues.critical, ["critical"]);
        });

        test("a monitor without the tag has no label for it at all", () => {
            const prometheus = buildPrometheus([]);
            assert.strictEqual(prometheus.monitorLabelValues.production, undefined);
        });
    });
});
