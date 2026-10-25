import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Prometheus } = require("../../server/prometheus");

describe("Prometheus", () => {
    describe("constructor", () => {
        test("builds the monitor label values", () => {
            const monitor = {
                id: 12,
                name: "API",
                type: "http",
                url: "https://example.com",
                hostname: "example.com",
                port: 443,
            };

            const prometheus = new Prometheus(monitor, []);

            assert.deepStrictEqual(prometheus.monitorLabelValues, {
                monitor_id: 12,
                monitor_name: "API",
                monitor_type: "http",
                monitor_url: "https://example.com",
                monitor_hostname: "example.com",
                monitor_port: 443,
            });
        });

        test("adds sanitized tag labels", () => {
            const monitor = { id: 1, name: "db", type: "port", hostname: "db.local", port: 5432 };
            const tags = [
                { name: "env", value: "prod" },
                { name: "team name", value: "data ops" },
            ];

            const prometheus = new Prometheus(monitor, tags);

            assert.deepStrictEqual(prometheus.monitorLabelValues.env, ["prod"]);
            assert.deepStrictEqual(prometheus.monitorLabelValues.teamname, ["dataops"]);
        });
    });
});
