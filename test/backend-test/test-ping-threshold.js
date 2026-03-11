const { describe, test, mock } = require("node:test");
const assert = require("node:assert");
const notificationModulePath = require.resolve("../../server/notification");

require.cache[notificationModulePath] = {
    id: notificationModulePath,
    filename: notificationModulePath,
    loaded: true,
    exports: {
        Notification: {
            send: async () => {},
        },
    },
};

const Monitor = require("../../server/model/monitor");
const { Notification } = require("../../server/notification");
const { UptimeKumaServer } = require("../../server/uptime-kuma-server");
const { R } = require("redbean-node");
const { UP } = require("../../src/util");
const dayjs = require("dayjs");

dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));

/**
 * Create a monitor-shaped object without constructing a RedBean bean.
 * @param {object} props Custom monitor properties
 * @returns {Monitor} Monitor-like object
 */
function createMonitor(props = {}) {
    return Object.assign(Object.create(Monitor.prototype), {
        conditions: "[]",
        kafkaProducerBrokers: "[]",
        kafkaProducerSaslOptions: "{}",
        rabbitmqNodes: "[]",
        accepted_statuscodes_json: "[\"200-299\"]",
        toJSON() {
            return {
                id: this.id,
                name: this.name,
                active: this.active,
                type: this.type,
                url: this.url,
                hostname: this.hostname,
            };
        },
        ...props,
    });
}

/**
 * Create a heartbeat-like object for threshold notification tests.
 * @param {object} props Custom heartbeat properties
 * @returns {object} Heartbeat-like object
 */
function createBeat(props = {}) {
    return {
        time: "2026-03-11 10:00:00",
        msg: "",
        toJSONAsync: async function () {
            return {
                time: this.time,
                msg: this.msg,
                ping: this.ping,
                status: this.status,
            };
        },
        ...props,
    };
}

describe("Ping Threshold", () => {
    test("validate() normalizes ping threshold fields", () => {
        const monitor = createMonitor({
            type: "http",
            name: "Example",
            ping_threshold: "500.8",
            ping_threshold_action: "notify",
        });

        monitor.validate();

        assert.strictEqual(monitor.ping_threshold, 501);
        assert.strictEqual(monitor.ping_threshold_action, "notify");
    });

    test("validate() rejects ping threshold on unsupported monitor types", () => {
        const monitor = createMonitor({
            type: "push",
            ping_threshold: 500,
        });

        assert.throws(() => monitor.validate(), /Ping threshold is not supported/);
    });

    test("handlePingThreshold() throws in down mode when threshold is exceeded", async () => {
        const monitor = createMonitor({
            type: "http",
            ping_threshold: 500,
            ping_threshold_action: "down",
        });

        await assert.rejects(
            async () => Monitor.handlePingThreshold(monitor, { status: UP, ping: 650 }),
            /Ping threshold exceeded: 650 ms > 500 ms/
        );
    });

    test("handlePingThresholdNotifications() sends a breach notification once", async () => {
        const monitor = createMonitor({
            id: 1,
            name: "API",
            active: true,
            type: "http",
            ping_threshold: 500,
            ping_threshold_action: "notify",
        });

        const calls = [];
        mock.method(Monitor, "getNotificationList", async () => [
            {
                name: "Webhook",
                config: JSON.stringify({ type: "webhook" }),
            },
        ]);
        mock.method(Monitor, "preparePreloadData", async () => ({}));
        mock.method(UptimeKumaServer, "getInstance", () => ({
            getTimezone: async () => "UTC",
            getTimezoneOffset: () => "+00:00",
        }));
        mock.method(R, "exec", async () => {});
        mock.method(Notification, "send", async (...args) => {
            calls.push(args);
        });

        try {
            await Monitor.handlePingThresholdNotifications(
                monitor,
                createBeat({ status: UP, ping: 750 })
            );
        } finally {
            mock.restoreAll();
        }

        assert.strictEqual(calls.length, 1);
        assert.match(calls[0][1], /\[API\] \[High Latency\] 750 ms > 500 ms/);
        assert.strictEqual(calls[0][2].id, 1);
        assert.strictEqual(calls[0][2].name, "API [Ping Threshold]");
        assert.strictEqual(calls[0][2].monitorID, "ping-threshold-1");
        assert.strictEqual(calls[0][2].notificationEventId, "ping-threshold-1");
        assert.strictEqual(calls[0][3].monitorID, "ping-threshold-1");
        assert.strictEqual(calls[0][3].id, "ping-threshold-1");
        assert.strictEqual(calls[0][3].status, 0);
        assert.strictEqual(calls[0][3].pingThreshold, 500);
        assert.strictEqual(calls[0][3].notificationEventId, "ping-threshold-1");
    });

    test("handlePingThresholdNotifications() sends a recovery notification once", async () => {
        const monitor = createMonitor({
            id: 1,
            name: "API",
            active: true,
            type: "http",
            ping_threshold: 500,
            ping_threshold_action: "notify",
        });

        const calls = [];
        mock.method(Monitor, "getNotificationList", async () => [
            {
                name: "Webhook",
                config: JSON.stringify({ type: "webhook" }),
            },
        ]);
        mock.method(Monitor, "preparePreloadData", async () => ({}));
        mock.method(UptimeKumaServer, "getInstance", () => ({
            getTimezone: async () => "UTC",
            getTimezoneOffset: () => "+00:00",
        }));
        mock.method(R, "exec", async () => {});
        mock.method(Notification, "send", async (...args) => {
            calls.push(args);
        });

        try {
            await Monitor.handlePingThresholdNotifications(monitor, createBeat({ status: UP, ping: 700 }));
            await Monitor.handlePingThresholdNotifications(monitor, createBeat({ status: UP, ping: 120 }));
        } finally {
            mock.restoreAll();
        }

        assert.strictEqual(calls.length, 2);
        assert.match(calls[1][1], /\[API\] \[Latency Recovered\] 120 ms <= 500 ms/);
        assert.strictEqual(calls[1][3].status, 1);
    });

    test("handlePingThresholdNotifications() does not spam while remaining above threshold", async () => {
        const monitor = createMonitor({
            id: 1,
            name: "API",
            active: true,
            type: "http",
            ping_threshold: 500,
            ping_threshold_action: "notify",
        });

        mock.method(Monitor, "getNotificationList", async () => [
            {
                name: "Webhook",
                config: JSON.stringify({ type: "webhook" }),
            },
        ]);
        mock.method(Monitor, "preparePreloadData", async () => ({}));
        mock.method(UptimeKumaServer, "getInstance", () => ({
            getTimezone: async () => "UTC",
            getTimezoneOffset: () => "+00:00",
        }));
        mock.method(R, "exec", async () => {});
        const sendMock = mock.method(Notification, "send", async () => {});

        try {
            await Monitor.handlePingThresholdNotifications(monitor, createBeat({ status: UP, ping: 700 }));
            await Monitor.handlePingThresholdNotifications(monitor, createBeat({ status: UP, ping: 750 }));
        } finally {
            mock.restoreAll();
        }

        assert.strictEqual(sendMock.mock.callCount(), 1);
    });

    test("handlePingThresholdNotifications() alerts on first high-latency beat", async () => {
        const monitor = createMonitor({
            id: 1,
            name: "API",
            active: true,
            type: "http",
            ping_threshold: 500,
            ping_threshold_action: "notify",
        });

        const calls = [];
        mock.method(Monitor, "getNotificationList", async () => [
            {
                name: "Webhook",
                config: JSON.stringify({ type: "webhook" }),
            },
        ]);
        mock.method(Monitor, "preparePreloadData", async () => ({}));
        mock.method(UptimeKumaServer, "getInstance", () => ({
            getTimezone: async () => "UTC",
            getTimezoneOffset: () => "+00:00",
        }));
        mock.method(R, "exec", async () => {});
        mock.method(Notification, "send", async (...args) => {
            calls.push(args);
        });

        try {
            await Monitor.handlePingThresholdNotifications(monitor, createBeat({ status: UP, ping: 750 }));
        } finally {
            mock.restoreAll();
        }

        assert.strictEqual(calls.length, 1);
        assert.match(calls[0][1], /\[API\] \[High Latency\] 750 ms > 500 ms/);
    });

    test("handlePingThresholdNotifications() preserves high-latency state across monitor reloads", async () => {
        const monitor = createMonitor({
            id: 1,
            name: "API",
            active: true,
            type: "http",
            ping_threshold: 500,
            ping_threshold_action: "notify",
            ping_threshold_last_notified_state: true,
        });

        mock.method(Monitor, "getNotificationList", async () => [
            {
                name: "Webhook",
                config: JSON.stringify({ type: "webhook" }),
            },
        ]);
        mock.method(Monitor, "preparePreloadData", async () => ({}));
        mock.method(UptimeKumaServer, "getInstance", () => ({
            getTimezone: async () => "UTC",
            getTimezoneOffset: () => "+00:00",
        }));
        mock.method(R, "exec", async () => {});
        const sendMock = mock.method(Notification, "send", async () => {});

        try {
            await Monitor.handlePingThresholdNotifications(monitor, createBeat({ status: UP, ping: 750 }));
        } finally {
            mock.restoreAll();
        }

        assert.strictEqual(sendMock.mock.callCount(), 0);
    });

    test("handlePingThresholdNotifications() resolves an open latency incident when monitor goes non-UP", async () => {
        const monitor = createMonitor({
            id: 1,
            name: "API",
            active: true,
            type: "http",
            ping_threshold: 500,
            ping_threshold_action: "notify",
            ping_threshold_last_notified_state: true,
        });

        const calls = [];
        mock.method(Monitor, "getNotificationList", async () => [
            {
                name: "Webhook",
                config: JSON.stringify({ type: "webhook" }),
            },
        ]);
        mock.method(Monitor, "preparePreloadData", async () => ({}));
        mock.method(UptimeKumaServer, "getInstance", () => ({
            getTimezone: async () => "UTC",
            getTimezoneOffset: () => "+00:00",
        }));
        mock.method(R, "exec", async () => {});
        mock.method(Notification, "send", async (...args) => {
            calls.push(args);
        });

        try {
            await Monitor.handlePingThresholdNotifications(monitor, createBeat({ status: 0, ping: null }));
        } finally {
            mock.restoreAll();
        }

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0][3].status, 1);
        assert.strictEqual(monitor.ping_threshold_last_notified_state, false);
        assert.match(calls[0][1], /\[API\] \[Latency Recovered\]/);
    });
});
