import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Monitor = require("../../server/model/monitor");
const { MIN_INTERVAL_SECOND, RESPONSE_BODY_LENGTH_MAX } = require("../../src/util");

/**
 * Build a Monitor instance without touching the database
 * @param {object} fields Monitor fields
 * @returns {object} Monitor instance
 */
function monitorWith(fields) {
    // toJSON() parses these JSON columns unconditionally
    return Object.assign(
        Object.create(Monitor.prototype),
        {
            kafkaProducerBrokers: "[]",
            kafkaProducerSaslOptions: "{}",
            rabbitmqNodes: "[]",
            conditions: "[]",
            accepted_statuscodes_json: '["200-299"]',
        },
        fields
    );
}

/**
 * Preload maps as produced by Monitor.preparePreloadData()
 * @param {number} id Monitor id
 * @returns {object} Preload data
 */
function preloadFor(id) {
    return {
        paths: new Map([[id, ["Group"]]]),
        childrenIDs: new Map([[id, [2, 3]]]),
        activeStatus: new Map([[id, true]]),
        forceInactive: new Map([[id, false]]),
        tags: new Map([[id, [{ id: 1, name: "env", value: "prod" }]]]),
        notifications: new Map([[id, { 1: true }]]),
        maintenanceStatus: new Map([[id, false]]),
    };
}

describe("Monitor", () => {
    describe("getUrl()", () => {
        test("returns a URL object for a valid url", () => {
            const monitor = monitorWith({ url: "https://example.com/path?q=1" });

            assert.strictEqual(monitor.getUrl().href, "https://example.com/path?q=1");
        });

        test("returns null for an invalid url", () => {
            assert.strictEqual(monitorWith({ url: "not a url" }).getUrl(), null);
        });
    });

    describe("getURLProtocol()", () => {
        test("returns the protocol of a valid url", () => {
            assert.strictEqual(monitorWith({ url: "https://example.com" }).getURLProtocol(), "https:");
        });

        test("returns null for an invalid url", () => {
            assert.strictEqual(monitorWith({ url: "example" }).getURLProtocol(), null);
        });
    });

    describe("getAcceptedStatuscodes()", () => {
        test("parses the stored JSON array", () => {
            const monitor = monitorWith({ accepted_statuscodes_json: '["200-299","404"]' });

            assert.deepStrictEqual(monitor.getAcceptedStatuscodes(), ["200-299", "404"]);
        });
    });

    describe("boolean getters", () => {
        test("coerce stored numbers to booleans", () => {
            const monitor = monitorWith({
                upsideDown: 1,
                ignoreTls: 0,
                ping_numeric: 1,
                invertKeyword: 0,
                cacheBust: 1,
                grpcEnableTls: 0,
                save_response: 1,
                save_error_response: 0,
                expiryNotification: 1,
                kafkaProducerSsl: 1,
            });

            assert.strictEqual(monitor.isUpsideDown(), true);
            assert.strictEqual(monitor.getIgnoreTls(), false);
            assert.strictEqual(monitor.isPingNumeric(), true);
            assert.strictEqual(monitor.isInvertKeyword(), false);
            assert.strictEqual(monitor.getCacheBust(), true);
            assert.strictEqual(monitor.getGrpcEnableTls(), false);
            assert.strictEqual(monitor.getSaveResponse(), true);
            assert.strictEqual(monitor.getSaveErrorResponse(), false);
            assert.strictEqual(monitor.isEnabledExpiryNotification(), true);
            assert.strictEqual(monitor.getKafkaProducerSsl(), true);
        });
    });

    describe("validate()", () => {
        test("accepts a valid configuration", () => {
            const monitor = monitorWith({ interval: MIN_INTERVAL_SECOND, retryInterval: MIN_INTERVAL_SECOND });

            assert.doesNotThrow(() => monitor.validate());
        });

        test("rejects an interval below the minimum", () => {
            const monitor = monitorWith({ interval: MIN_INTERVAL_SECOND - 1, retryInterval: MIN_INTERVAL_SECOND });

            assert.throws(() => monitor.validate(), /Interval cannot be less than/);
        });

        test("rejects a retry interval below the minimum", () => {
            const monitor = monitorWith({ interval: MIN_INTERVAL_SECOND, retryInterval: MIN_INTERVAL_SECOND - 1 });

            assert.throws(() => monitor.validate(), /Retry interval cannot be less than/);
        });

        test("rejects a negative response max length", () => {
            const monitor = monitorWith({
                interval: MIN_INTERVAL_SECOND,
                retryInterval: MIN_INTERVAL_SECOND,
                response_max_length: -1,
            });

            assert.throws(() => monitor.validate(), /Response max length cannot be less than 0/);
        });

        test("rejects a response max length above the limit", () => {
            const monitor = monitorWith({
                interval: MIN_INTERVAL_SECOND,
                retryInterval: MIN_INTERVAL_SECOND,
                response_max_length: RESPONSE_BODY_LENGTH_MAX + 1,
            });

            assert.throws(() => monitor.validate(), /Response max length cannot be more than/);
        });

        test("rejects invalid kafka producer brokers JSON", () => {
            const monitor = monitorWith({
                interval: MIN_INTERVAL_SECOND,
                retryInterval: MIN_INTERVAL_SECOND,
                kafkaProducerBrokers: "{not json",
            });

            assert.throws(() => monitor.validate(), /Kafka Producer Brokers must be valid JSON/);
        });
    });

    describe("isImportantBeat()", () => {
        test("treats the first beat as important", () => {
            assert.strictEqual(Monitor.isImportantBeat(true, null, 0), true);
        });

        test("treats up to down as important", () => {
            assert.strictEqual(Monitor.isImportantBeat(false, 1, 0), true);
        });

        test("treats down to up as important", () => {
            assert.strictEqual(Monitor.isImportantBeat(false, 0, 1), true);
        });

        test("treats pending to down as important", () => {
            assert.strictEqual(Monitor.isImportantBeat(false, 2, 0), true);
        });

        test("treats maintenance to up as important", () => {
            assert.strictEqual(Monitor.isImportantBeat(false, 3, 1), true);
        });

        test("treats up to maintenance as important", () => {
            assert.strictEqual(Monitor.isImportantBeat(false, 1, 3), true);
        });

        test("treats up to up as not important", () => {
            assert.strictEqual(Monitor.isImportantBeat(false, 1, 1), false);
        });

        test("treats down to down as not important", () => {
            assert.strictEqual(Monitor.isImportantBeat(false, 0, 0), false);
        });
    });

    describe("isImportantForNotification()", () => {
        test("treats maintenance to up as not important", () => {
            assert.strictEqual(Monitor.isImportantForNotification(false, 3, 1), false);
        });

        test("treats down to maintenance as not important", () => {
            assert.strictEqual(Monitor.isImportantForNotification(false, 0, 3), false);
        });

        test("treats maintenance to down as important", () => {
            assert.strictEqual(Monitor.isImportantForNotification(false, 3, 0), true);
        });

        test("treats the first beat as important", () => {
            assert.strictEqual(Monitor.isImportantForNotification(true, null, 0), true);
        });
    });

    describe("toJSON()", () => {
        test("adds preloaded paths, children, tags and status", () => {
            const monitor = monitorWith({
                id: 1,
                name: "api",
                type: "http",
                url: "https://example.com",
                interval: 60,
                weight: 2000,
                parent: null,
                accepted_statuscodes_json: '["200-299"]',
            });

            const json = monitor.toJSON(preloadFor(1));

            assert.strictEqual(json.id, 1);
            assert.strictEqual(json.name, "api");
            assert.strictEqual(json.pathName, "Group");
            assert.deepStrictEqual(json.childrenIDs, [2, 3]);
            assert.deepStrictEqual(json.tags, [{ id: 1, name: "env", value: "prod" }]);
            assert.strictEqual(json.active, true);
        });

        test("omits sensitive request data unless explicitly included", () => {
            const monitor = monitorWith({
                id: 1,
                name: "api",
                type: "http",
                url: "https://example.com",
                interval: 60,
                accepted_statuscodes_json: '["200-299"]',
                headers: '{"x-key":"secret"}',
                body: "payload",
            });

            const publicJson = monitor.toJSON(preloadFor(1), false);
            const fullJson = monitor.toJSON(preloadFor(1), true);

            assert.strictEqual(publicJson.headers, undefined);
            assert.strictEqual(publicJson.body, undefined);
            assert.strictEqual(fullJson.headers, '{"x-key":"secret"}');
            assert.strictEqual(fullJson.body, "payload");
        });

        test("adds a screenshot path for real-browser monitors", () => {
            const monitor = monitorWith({
                id: 1,
                name: "browser",
                type: "real-browser",
                weight: 2000,
                accepted_statuscodes_json: '["200-299"]',
            });

            const json = monitor.toJSON(preloadFor(1));

            assert.strictEqual(json.screenshot, "/screenshots/1.png");
        });
    });
});
