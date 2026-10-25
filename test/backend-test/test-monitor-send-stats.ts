import { afterEach, describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Monitor = require("../../server/model/monitor");
const { MonitorStats } = require("../../server/monitor-stats");
import { socketRoom } from "../../server/heartbeat-emit";

const originals = {
    get: MonitorStats.get,
    maybeRefresh: MonitorStats.maybeRefresh,
    sendCertInfo: Monitor.sendCertInfo,
    sendDomainInfo: Monitor.sendDomainInfo,
    now: Date.now,
};

afterEach(() => {
    MonitorStats.get = originals.get;
    MonitorStats.maybeRefresh = originals.maybeRefresh;
    Monitor.sendCertInfo = originals.sendCertInfo;
    Monitor.sendDomainInfo = originals.sendDomainInfo;
    Date.now = originals.now;
});

/**
 * Socket.io-like object with an optional client in the dashboard room
 * @param {boolean} hasClient Whether the room has a socket
 * @returns {object} IO with recorded events
 */
function fakeIo(hasClient) {
    const events = [];
    return {
        events,
        sockets: {
            adapter: {
                rooms: new Map(hasClient ? [[socketRoom, new Set(["socket"])]] : []),
            },
        },
        to(room) {
            return {
                emit(event, ...args) {
                    events.push({ room, event, args });
                },
            };
        },
    };
}

/**
 * Stub the cert/domain senders
 * @returns {object} Call counters
 */
function stubInfoSenders() {
    const calls = { cert: 0, domain: 0 };
    Monitor.sendCertInfo = async () => {
        calls.cert++;
    };
    Monitor.sendDomainInfo = async () => {
        calls.domain++;
    };
    return calls;
}

describe("Monitor.sendStats()", () => {
    test("does nothing when nobody is connected", async () => {
        const io = fakeIo(false);
        const calls = stubInfoSenders();
        let refreshed = 0;
        MonitorStats.get = () => undefined;
        MonitorStats.maybeRefresh = () => {
            refreshed++;
        };

        await Monitor.sendStats(io, 1);

        assert.strictEqual(io.events.length, 0);
        assert.deepStrictEqual(calls, { cert: 0, domain: 0 });
        assert.strictEqual(refreshed, 0);
    });

    test("emits the cached stats and sends cert/domain info once per minute", async () => {
        const io = fakeIo(true);
        const calls = stubInfoSenders();
        const cached = { avgPing: 12.5, uptime24: 0.99, uptime720: 0.98, uptime1y: 0.97 };
        let refreshed = 0;
        MonitorStats.get = () => cached;
        MonitorStats.maybeRefresh = () => {
            refreshed++;
        };
        Date.now = () => 1000000;

        await Monitor.sendStats(io, 101);

        const statsEvents = io.events.filter((event) => event.event === "stats");
        assert.strictEqual(statsEvents.length, 1);
        assert.deepStrictEqual(statsEvents[0].args[0], { 101: cached });
        assert.strictEqual(refreshed, 1);
        assert.deepStrictEqual(calls, { cert: 1, domain: 1 });

        // A second beat within the same minute only emits the stats
        await Monitor.sendStats(io, 101);

        assert.strictEqual(io.events.filter((event) => event.event === "stats").length, 2);
        assert.deepStrictEqual(calls, { cert: 1, domain: 1 });
    });

    test("sends the info again after the refresh interval", async () => {
        const io = fakeIo(true);
        const calls = stubInfoSenders();
        MonitorStats.get = () => undefined;
        MonitorStats.maybeRefresh = () => {};
        Date.now = () => 2000000;

        await Monitor.sendStats(io, 202);
        Date.now = () => 2000000 + 60 * 1000;
        await Monitor.sendStats(io, 202);

        assert.deepStrictEqual(calls, { cert: 2, domain: 2 });
    });

    test("skips the stats event when no cache entry exists", async () => {
        const io = fakeIo(true);
        stubInfoSenders();
        MonitorStats.get = () => undefined;
        MonitorStats.maybeRefresh = () => {};
        Date.now = () => 3000000;

        await Monitor.sendStats(io, 303);

        assert.strictEqual(io.events.filter((event) => event.event === "stats").length, 0);
    });
});
