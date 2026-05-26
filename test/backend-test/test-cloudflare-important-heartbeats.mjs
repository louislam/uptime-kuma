import { describe, test } from "node:test";
import assert from "node:assert";

import {
    buildCloudflareImportantHeartbeatResult,
} from "../../src/util/cloudflare-important-heartbeats.mjs";

describe("Cloudflare Worker cached important heartbeats", () => {
    test("builds dashboard event rows from cached heartbeat history when the Worker event API is unavailable", () => {
        const monitorList = {
            7: { id: 7, name: "Primary WAN", active: true },
            8: { id: 8, name: "VPN Edge", active: true },
            9: { id: 9, name: "Paused LTE", active: false },
        };
        const heartbeatList = {
            7: [
                { monitorID: 7, status: 1, msg: "primary up", time: "2026-05-12 04:00:00" },
                { monitorID: 7, status: 0, msg: "primary older down", time: "2026-05-12 04:15:00" },
                { monitorID: 7, status: 1, msg: "primary older recovered", time: "2026-05-12 04:16:00" },
                { monitorID: 7, status: 0, msg: "primary newest down", time: "2026-05-23 10:00:00" },
            ],
            8: [
                { monitorID: 8, status: 1, msg: "vpn up", time: "2026-05-22 08:00:00" },
                { monitorID: 8, status: 2, msg: "vpn newer pending", time: "2026-05-22 08:10:00" },
                { monitorID: 8, status: 1, msg: "vpn newer recovered", time: "2026-05-22 08:11:00" },
            ],
            9: [
                { monitorID: 9, status: 0, msg: "paused newest down", time: "2026-05-23 11:00:00" },
            ],
        };

        const result = buildCloudflareImportantHeartbeatResult(monitorList, heartbeatList, null, 0, 3);

        assert.strictEqual(result.count, 5);
        assert.deepStrictEqual(
            result.heartbeats.map((heartbeat) => heartbeat.msg),
            [
                "primary newest down",
                "vpn newer recovered",
                "vpn newer pending",
            ]
        );
    });

    test("supports monitor-specific cached event pagination", () => {
        const monitorList = {
            7: { id: 7, name: "Primary WAN", active: true },
        };
        const heartbeatList = {
            7: [
                { monitorID: 7, status: 1, msg: "initial up", time: "2026-05-11 02:00:00" },
                { monitorID: 7, status: 2, msg: "retry pending", time: "2026-05-11 02:02:00" },
                { monitorID: 7, status: 2, msg: "still pending", time: "2026-05-11 02:03:00" },
                { monitorID: 7, status: 1, msg: "recovered from pending", time: "2026-05-11 02:04:00" },
                { monitorID: 7, status: 0, msg: "down", time: "2026-05-11 02:06:00" },
                { monitorID: 7, status: 0, msg: "still down", time: "2026-05-11 02:07:00" },
                { monitorID: 7, status: 1, msg: "recovered from down", time: "2026-05-11 02:08:00" },
            ],
        };

        const result = buildCloudflareImportantHeartbeatResult(monitorList, heartbeatList, 7, 1, 3);

        assert.strictEqual(result.count, 6);
        assert.deepStrictEqual(
            result.heartbeats.map((heartbeat) => heartbeat.msg),
            [
                "still down",
                "down",
                "recovered from pending",
            ]
        );
    });
});
