import { afterEach, describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";
import http from "node:http";
import https from "node:https";

const require = createRequire(import.meta.url);
const Monitor = require("../../server/model/monitor");
const { R } = require("redbean-node");
const { UptimeCalculator } = require("../../server/uptime-calculator");
const { Prometheus } = require("../../server/prometheus");
import { socketRoom } from "../../server/heartbeat-emit";

// Self-signed certificate for 127.0.0.1, tests only
const TEST_CERT = `-----BEGIN CERTIFICATE-----
MIIDGjCCAgKgAwIBAgIUBDEuoYxCxNILP6rHwaw2Opgn1nYwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJMTI3LjAuMC4xMB4XDTI2MTAyNDE4MTA0N1oXDTM2MTAy
MTE4MTA0N1owFDESMBAGA1UEAwwJMTI3LjAuMC4xMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAsg0yB6hTl9+/G6quAdQOLT7710xuPoFnnTxiSaEKApuY
Rs+yLg9KcMoiY3eFjdWn4KTfjMy6/Kibm9dbLXYI/5mXIwEDcW85SptFny6SKPVA
mRcX436TxDYkDYWNAxtQROam2C1JLOJOHofPZvo5rkQsYLu+9Px2kWVdU85CmFxL
MbLUyOxaMOjqZtBeTTFY7I0NBW8tOsdhJWhdsEH0Yw9zYwpsvpcO5YQHMFFEHdC+
2E2vKxkuwH7lz+p9K1CG5JTZ8sMdo9y7CicTYSHYTwhnwqJsfltPV/CeqBMpL4IP
qMxNO9VeR79KN/J5/oZvsdFSjT7GaReEAesPjaR0vwIDAQABo2QwYjAdBgNVHQ4E
FgQUghkRk5FifZZdAa1DhBo41vuXmCIwHwYDVR0jBBgwFoAUghkRk5FifZZdAa1D
hBo41vuXmCIwDwYDVR0TAQH/BAUwAwEB/zAPBgNVHREECDAGhwR/AAABMA0GCSqG
SIb3DQEBCwUAA4IBAQBXUy0QPY88+Q2GyI59EfWq0mYRTUVa+Dv0lz+W4V3tBR4b
Cvh0VEZEpuo5uyiRreVOyjTXinRJVDA+xk6XYzTbwqUj9MRkwbVa/qqydBr/Zrwa
rZSDTmzIWSO2RQMOeI8zkK6SND5Lg8K4aWNjmoAJs/t/ZYaINxk2AUotmXM5bKPP
7QnNORbZgqoyse5Ct+7c2L6ngQOiDKiNG8AisAVI91C5v6M/5AVIIAlENtH4V9sy
HEAOA+GcFrb1hlIjbK61ff1nj2ni7HZtSlrK9HRhNTLOtkpkXcQUL3OqSyhVsCnV
vD02OP0l7N8x0j5O4c2YiqbpUsQ6p4LcYYmBCO/T
-----END CERTIFICATE-----`;
const TEST_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCyDTIHqFOX378b
qq4B1A4tPvvXTG4+gWedPGJJoQoCm5hGz7IuD0pwyiJjd4WN1afgpN+MzLr8qJub
11stdgj/mZcjAQNxbzlKm0WfLpIo9UCZFxfjfpPENiQNhY0DG1BE5qbYLUks4k4e
h89m+jmuRCxgu770/HaRZV1TzkKYXEsxstTI7Fow6Opm0F5NMVjsjQ0Fby06x2El
aF2wQfRjD3NjCmy+lw7lhAcwUUQd0L7YTa8rGS7AfuXP6n0rUIbklNnywx2j3LsK
JxNhIdhPCGfComx+W09X8J6oEykvgg+ozE071V5Hv0o38nn+hm+x0VKNPsZpF4QB
6w+NpHS/AgMBAAECggEAMnvXUaCCgy9nqlqMl+weUOno0jTTlVlvnX9/hszoX7Dq
TjmZlcG0I6LMeVNsRLjtrp5Q3EU4R2cvJ9K6AXvUNVTBK6Wf6kvU/Lhl1yqHOqG/
PSj1FwXOs/V952+UeesGqWKUr/q3IsjPyYxMXDBapnSh+JODI0dp/vO0sIxtCXG4
tP4R9QkhEhQ+1KmhgQuYVN0NVje/wxE3dCLBgRpNSMBI583/K69IT05pEtkdaLk3
KklZqowdSUmehjdZXG0kDFSkjWLa2bchy/BdiVHGQyxWI3R048WIQ2t2pDQinM1x
MLHoxHb2hNmUCGcKhkJS7GXx1VBL24sdd+P7fgVLEQKBgQDXmTR5E40v3uXC74RN
7umqgUDp5yt/ufiMU5sJ60MXruYh7PpdRJBA5rMtvXw4nT8QWfPElOBb2fH4HFIX
X4lmf5jHGBJ1B+Xo26Of2yDd0cZuX/lva+zOmJkfH0zGRV0ruSubOsDWXgLZk1bC
dK/GfuMSRIbDw9Xzb0bgUUeq3QKBgQDTasWEFjUd/L5XJhAa6XcjGiIWdCJBbUla
0kSAU1cAJpHVYuaNJxyZf20EhmSDQI23JvjKbuf02tPot3RdCX2piScnvUxxcG4G
Pj6MDOpc3rTTqt6oer5aRQH/qbDUCVyMc58h1sL8hbAVd/TsLOODHCjTppB7f2JW
6rzTbWWeSwKBgEY+05rzZNgJDuFhusDNq/Jy5JyRRln6VOIbx3MG5ThNMwwwsy46
TannwM+RYmzrxwVj2YneW+9xZmZJi/Gzngf4YOXVkQXyidVB4uENu3qqg7WorZPB
HUn+7Dz4rMIZDY9WaL/N99CgltsfJ3B6Jl9NLlzgWOxl3UrQoc4qjWg9AoGBAMz1
cvzFxsMGlsTIGs7sTVqTaD6aYedJ+tZ4iH5bzTlRKwpS8i4fn8NT3K2JWIJCH+FS
f9lIwckIKG4xBDd6DwA//dyx0R0coR2eVGbT0pUsNuQJgAiXzliXFAP2T36QgM+M
+9YDbU8AkB+QBrq8HeiqcQ4XKXUAnqaitWLHaL+XAoGAe2xBuTtY9j06N3xOI+BB
Ou1aoTvfAnTcR4EtnZwfrcC2yJScPPc7I6LhS8s2bqv5PqETvyDMZKR4ptpK6+y4
ZxS1xQ23DAuKVk7/lHpiwQAIeWp9WT0ZXCIQEoNUSOqyERB7DiGeIu/dEXaQGMv8
bKYQDvxfHpW3ZVybuKBDgGU=
-----END PRIVATE KEY-----`;

const originals = {
    findOne: R.findOne,
    dispense: R.dispense,
    store: R.store,
    isoDateTimeMillis: R.isoDateTimeMillis,
    getUptimeCalculator: UptimeCalculator.getUptimeCalculator,
    sendNotification: Monitor.sendNotification,
    sendStats: Monitor.sendStats,
    isUnderMaintenance: Monitor.isUnderMaintenance,
    load: R.load,
    prometheusUpdate: Prometheus.prototype.update,
    prometheusRemove: Prometheus.prototype.remove,
    handleTlsInfo: Monitor.prototype.handleTlsInfo,
};

afterEach(() => {
    R.findOne = originals.findOne;
    R.dispense = originals.dispense;
    R.store = originals.store;
    R.isoDateTimeMillis = originals.isoDateTimeMillis;
    UptimeCalculator.getUptimeCalculator = originals.getUptimeCalculator;
    Monitor.sendNotification = originals.sendNotification;
    Monitor.sendStats = originals.sendStats;
    Monitor.isUnderMaintenance = originals.isUnderMaintenance;
    R.load = originals.load;
    Prometheus.prototype.update = originals.prometheusUpdate;
    Prometheus.prototype.remove = originals.prometheusRemove;
    Monitor.prototype.handleTlsInfo = originals.handleTlsInfo;
});

/**
 * Start an HTTP server that answers every request with 200 OK
 * @returns {Promise<{url: string, close: Function}>} Server URL and closer
 */
async function localServer() {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    return {
        url: `http://127.0.0.1:${port}/`,
        close: () => new Promise((resolve) => server.close(resolve)),
    };
}

/**
 * Monitor instance with every field a beat reads
 * @param {string} url Monitor URL
 * @returns {object} Monitor
 */
function fakeMonitor(url) {
    return Object.assign(Object.create(Monitor.prototype), {
        id: 9002,
        name: "Beat Monitor",
        type: "http",
        url,
        interval: 60,
        retryInterval: 60,
        resendInterval: 0,
        maxretries: 0,
        maxredirects: 10,
        timeout: 5,
        user_id: "user1",
        active: 1,
        ignore_tls: 0,
        upside_down: 0,
        save_response: 0,
        save_error_response: 0,
        expiry_notification: 0,
        domain_expiry_notification: 0,
        accepted_statuscodes_json: '["200-299"]',
        headers: null,
        body: null,
        method: "get",
        auth_method: null,
        proxy_id: null,
        ipFamily: null,
        cacheBust: false,
        getTags: async () => [],
    });
}

/**
 * Start an HTTPS server with the self-signed test certificate
 * @returns {Promise<{url: string, close: Function}>} Server URL and closer
 */
async function localTlsServer() {
    const server = https.createServer({ key: TEST_KEY, cert: TEST_CERT }, (req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    return {
        url: `https://127.0.0.1:${port}/`,
        close: () => new Promise((resolve) => server.close(resolve)),
    };
}

/**
 * IO with one client in the dashboard room
 * @returns {object} IO with captured events
 */
function fakeIo() {
    const events = [];
    return {
        events,
        sockets: { adapter: { rooms: new Map([[socketRoom, new Set(["socket"])]]) } },
        to(room) {
            return {
                emit(event, ...args) {
                    events.push({ room, event, args });
                },
            };
        },
    };
}

describe("Monitor beat over HTTP", () => {
    test("collects the certificate info from the TLS keylog event", async () => {
        const server = await localTlsServer();
        const monitor = fakeMonitor(server.url);
        monitor.ignoreTls = 1;
        const io = fakeIo();

        R.findOne = async () => null;
        R.dispense = () => ({
            monitor_id: monitor.id,
            toJSON() {
                return { monitor_id: this.monitor_id, status: this.status };
            },
        });
        R.store = async () => {};
        R.isoDateTimeMillis = () => "2024-01-01 00:00:00";
        UptimeCalculator.getUptimeCalculator = async () => ({
            update: async () => ({ unix: () => 1704067200 }),
        });
        Monitor.sendNotification = async () => {};
        Monitor.isUnderMaintenance = async () => false;
        Monitor.sendStats = async () => {};
        Prometheus.prototype.remove = () => {};

        let beatDone;
        const beatFinished = new Promise((resolve) => {
            beatDone = resolve;
        });
        Prometheus.prototype.update = () => {
            beatDone();
        };

        const tlsInfos = [];
        Monitor.prototype.handleTlsInfo = async function (tlsInfo) {
            tlsInfos.push(tlsInfo);
        };

        try {
            await monitor.start(io, 0);
            await Promise.race([
                beatFinished,
                new Promise((_, reject) => setTimeout(() => reject(new Error("beat timeout")), 5000)),
            ]);
            await new Promise((resolve) => setImmediate(resolve));

            assert.strictEqual(tlsInfos.length, 1, "certificate info handled once");
            assert.ok(tlsInfos[0].certInfo, "certificate parsed");
            assert.strictEqual(typeof tlsInfos[0].hostnameMatchMonitorUrl, "boolean");
        } finally {
            monitor.stop();
            await server.close();
        }
    });

    test("checks, emits the heartbeat and updates prometheus", async () => {
        const server = await localServer();
        const monitor = fakeMonitor(server.url);
        const io = fakeIo();

        R.findOne = async () => null;
        R.dispense = () => ({
            monitor_id: monitor.id,
            toJSON() {
                return { monitor_id: this.monitor_id, status: this.status, msg: this.msg };
            },
        });
        R.store = async () => {};
        R.isoDateTimeMillis = () => "2024-01-01 00:00:00";
        UptimeCalculator.getUptimeCalculator = async () => ({
            update: async () => ({ unix: () => 1704067200 }),
        });
        Monitor.sendNotification = async () => {};
        Monitor.isUnderMaintenance = async () => false;
        const prometheusUpdates = [];
        let beatDone;
        const beatFinished = new Promise((resolve) => {
            beatDone = resolve;
        });
        Prometheus.prototype.update = (...args) => {
            prometheusUpdates.push(args);
            beatDone();
        };
        Prometheus.prototype.remove = () => {};

        Monitor.sendStats = async () => {};

        try {
            await monitor.start(io, 0);
            // Prometheus is updated after the heartbeat was emitted and stored
            await Promise.race([
                beatFinished,
                new Promise((_, reject) => setTimeout(() => reject(new Error("beat timeout")), 5000)),
            ]);
            await new Promise((resolve) => setImmediate(resolve));

            const heartbeat = io.events.find((event) => event.event === "heartbeat");
            assert.ok(heartbeat, "heartbeat emitted");
            assert.strictEqual(heartbeat.args[0].status, 1);
            assert.strictEqual(prometheusUpdates.length, 1, "prometheus updated once");
            assert.strictEqual(prometheusUpdates[0][0].status, heartbeat.args[0].status);
        } finally {
            monitor.stop();
            await server.close();
        }
    });

    test("uses the proxy agents of an active proxy", async () => {
        const server = await localServer();
        const monitor = fakeMonitor(server.url);
        monitor.proxy_id = 42;
        const io = fakeIo();

        R.findOne = async () => null;
        R.dispense = () => ({
            monitor_id: monitor.id,
            toJSON() {
                return { monitor_id: this.monitor_id, status: this.status };
            },
        });
        R.store = async () => {};
        R.isoDateTimeMillis = () => "2024-01-01 00:00:00";
        R.load = async () => ({ id: 42, active: 1, protocol: "http", host: "127.0.0.1", port: 1, auth: false });
        UptimeCalculator.getUptimeCalculator = async () => ({
            update: async () => ({ unix: () => 1704067200 }),
        });
        Monitor.sendNotification = async () => {};
        Monitor.isUnderMaintenance = async () => false;
        Monitor.sendStats = async () => {};
        Prometheus.prototype.remove = () => {};

        let beatDone;
        const beatFinished = new Promise((resolve) => {
            beatDone = resolve;
        });
        Prometheus.prototype.update = () => {
            beatDone();
        };

        try {
            await monitor.start(io, 0);
            await Promise.race([
                beatFinished,
                new Promise((_, reject) => setTimeout(() => reject(new Error("beat timeout")), 5000)),
            ]);
            await new Promise((resolve) => setImmediate(resolve));

            const heartbeat = io.events.find((event) => event.event === "heartbeat");
            assert.ok(heartbeat, "heartbeat emitted");
            // The proxy port is closed, so the check reports DOWN through the proxy
            assert.strictEqual(heartbeat.args[0].status, 0);
        } finally {
            monitor.stop();
            await server.close();
        }
    });
});
