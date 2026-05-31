import { describe, test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";

import {
    buildMonitorIndexes,
    dedupeCloudflareDashboardRequest,
    getCachedCloudflareChartData,
    reuseUnchangedDashboardState,
    setCachedCloudflareChartData,
} from "../../src/util/cloudflare-dashboard-state.mjs";

/**
 * Read a project source file for source-level UI assertions.
 * @param {string} relativePath Source path relative to the repository root.
 * @returns {string} Source content.
 */
function readSource(relativePath) {
    return fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

describe("Cloudflare dashboard state helpers", () => {
    test("builds stable monitor tree indexes and active leaf lists", () => {
        const indexes = buildMonitorIndexes({
            1: { id: 1, name: "Endpoints", type: "group", active: true, parent: null, weight: 10 },
            2: { id: 2, name: "API", type: "http", active: true, parent: 1, weight: 10 },
            3: { id: 3, name: "Nested", type: "group", active: true, parent: 1, weight: 5 },
            4: { id: 4, name: "Ping", type: "ping", active: true, parent: 3, weight: 10 },
            5: { id: 5, name: "Paused", type: "ping", active: 0, parent: 3, weight: 10 },
            6: { id: 6, name: "Websites", type: "group", active: true, parent: null, weight: 5 },
        });

        assert.deepStrictEqual(indexes.rootMonitorIds, [1, 6]);
        assert.deepStrictEqual(indexes.childrenByParentId["1"], [2, 3]);
        assert.deepStrictEqual(indexes.childrenByParentId["3"], [4, 5]);
        assert.deepStrictEqual(indexes.activeLeafIdsByGroupId[1], [2, 4]);
        assert.deepStrictEqual(indexes.activeLeafIdsByGroupId[3], [4]);
    });

    test("dedupes in-flight dashboard requests", async () => {
        let calls = 0;
        const [first, second] = await Promise.all([
            dedupeCloudflareDashboardRequest("bootstrap-test", async () => {
                calls += 1;
                return { ok: true };
            }),
            dedupeCloudflareDashboardRequest("bootstrap-test", async () => {
                calls += 1;
                return { ok: false };
            }),
        ]);

        assert.strictEqual(calls, 1);
        assert.strictEqual(first, second);
        assert.deepStrictEqual(first, { ok: true });
    });

    test("persists and reads per-monitor chart cache entries", () => {
        const originalLocalStorage = globalThis.localStorage;
        const storage = new Map();
        globalThis.localStorage = {
            getItem(key) {
                return storage.get(key) || null;
            },
            setItem(key, value) {
                storage.set(key, value);
            },
            removeItem(key) {
                storage.delete(key);
            },
        };

        try {
            const data = [{ timestamp: 1, up: 1, down: 0, avgPing: 12 }];
            const cache = setCachedCloudflareChartData({}, 7, 24, data);

            assert.deepStrictEqual(getCachedCloudflareChartData(cache, 7, 24), data);
            assert.strictEqual(getCachedCloudflareChartData(cache, 7, 3), null);
            assert.ok(storage.size > 0);
        } finally {
            if (originalLocalStorage === undefined) {
                delete globalThis.localStorage;
            } else {
                globalThis.localStorage = originalLocalStorage;
            }
        }
    });

    test("reuses unchanged dashboard records during Worker refreshes", () => {
        const previousHeartbeatList = {
            1: [{ monitorID: 1, time: "2026-05-31 12:00:00", status: 1, ping: 12 }],
            2: [{ monitorID: 2, time: "2026-05-31 12:00:00", status: 0, ping: null }],
        };
        const previous = {
            monitorList: {
                1: { id: 1, name: "API", active: true, getUrl() {} },
                2: { id: 2, name: "Phone", active: true, getUrl() {} },
            },
            heartbeatList: previousHeartbeatList,
            avgPingList: {
                1: 12,
                2: null,
            },
            uptimeList: {
                "1_24": 1,
                "2_24": 0,
            },
        };
        const next = {
            monitorList: {
                1: { id: 1, name: "API", active: true },
                2: { id: 2, name: "Phone", active: false },
            },
            heartbeatList: {
                1: [{ monitorID: 1, time: "2026-05-31 12:00:00", status: 1, ping: 12 }],
                2: [
                    { monitorID: 2, time: "2026-05-31 12:00:00", status: 0, ping: null },
                    { monitorID: 2, time: "2026-05-31 12:01:00", status: 1, ping: 34 },
                ],
            },
            avgPingList: {
                1: 12,
                2: 34,
            },
            uptimeList: {
                "1_24": 1,
                "2_24": 0.5,
            },
        };

        const merged = reuseUnchangedDashboardState(previous, next);

        assert.notStrictEqual(merged.monitorList, previous.monitorList);
        assert.strictEqual(merged.monitorList[1], previous.monitorList[1]);
        assert.notStrictEqual(merged.monitorList[2], previous.monitorList[2]);
        assert.notStrictEqual(merged.heartbeatList, previous.heartbeatList);
        assert.strictEqual(merged.heartbeatList[1], previous.heartbeatList[1]);
        assert.notStrictEqual(merged.heartbeatList[2], previous.heartbeatList[2]);
        assert.strictEqual(merged.avgPingList[1], previous.avgPingList[1]);
        assert.strictEqual(merged.uptimeList["1_24"], previous.uptimeList["1_24"]);
    });

    test("returns existing dashboard records when refreshed payload is unchanged", () => {
        const previous = {
            monitorList: {
                1: { id: 1, name: "API", active: true, getUrl() {} },
            },
            heartbeatList: {
                1: [{ monitorID: 1, time: "2026-05-31 12:00:00", status: 1, ping: 12 }],
            },
            avgPingList: {
                1: 12,
            },
            uptimeList: {
                "1_24": 1,
            },
        };
        const next = {
            monitorList: {
                1: { id: 1, name: "API", active: true },
            },
            heartbeatList: {
                1: [{ monitorID: 1, time: "2026-05-31 12:00:00", status: 1, ping: 12 }],
            },
            avgPingList: {
                1: 12,
            },
            uptimeList: {
                "1_24": 1,
            },
        };

        const merged = reuseUnchangedDashboardState(previous, next);

        assert.strictEqual(merged.monitorList, previous.monitorList);
        assert.strictEqual(merged.heartbeatList, previous.heartbeatList);
        assert.strictEqual(merged.avgPingList, previous.avgPingList);
        assert.strictEqual(merged.uptimeList, previous.uptimeList);
    });

    test("monitor list components consume precomputed indexes and defer heartbeat canvases", () => {
        const monitorListSource = readSource("src/components/MonitorList.vue");
        const monitorListItemSource = readSource("src/components/MonitorListItem.vue");

        assert.match(monitorListSource, /\$root\.dashboardIndexes\?\.rootMonitorIds/);
        assert.match(monitorListItemSource, /\$root\.dashboardIndexes\?\.childrenByParentId/);
        assert.match(monitorListItemSource, /window\.IntersectionObserver/);
        assert.match(monitorListItemSource, /<HeartbeatBar v-if="heartbeatVisible"/);
        assert.match(monitorListItemSource, /class="heartbeat-placeholder"/);
    });
});
