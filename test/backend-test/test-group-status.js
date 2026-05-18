const { describe, test } = require("node:test");
const assert = require("node:assert");
const {
    DOWN,
    MAINTENANCE,
    PENDING,
    UP,
} = require("../../src/util");
const {
    UNKNOWN,
    buildGroupHeartbeatList,
    calculateGroupStatusBadge,
    calculateGroupStatus,
    calculateGroupUptime,
    getGroupChildMonitors,
} = require("../../src/util/group-status");

describe("group-status", () => {
    const monitors = [
        { id: 1, active: true },
        { id: 2, active: true },
    ];

    test("returns up and 100% uptime when every child is up", () => {
        const heartbeatList = {
            1: [{ status: UP, time: "2026-05-13 12:00:00" }],
            2: [{ status: UP, time: "2026-05-13 12:00:00" }],
        };
        const uptimeList = {
            "1_24": 1,
            "2_24": 1,
        };

        assert.strictEqual(calculateGroupStatus(monitors, heartbeatList), UP);
        assert.strictEqual(calculateGroupUptime(monitors, uptimeList, "24"), 1);
    });

    test("returns an up badge for a group whose children are all up", () => {
        const group = { id: 10, type: "group", active: true };
        const monitorList = {
            10: group,
            11: { id: 11, type: "http", parent: 10, active: true },
            12: { id: 12, type: "ping", parent: 10, active: true },
        };
        const heartbeatList = {
            11: [{ status: UP, time: "2026-05-18 12:00:00" }],
            12: [{ status: UP, time: "2026-05-18 12:00:00" }],
        };
        const translate = (key) => ({
            Up: "Up",
            Unknown: "Unknown",
        }[key] || key);

        assert.deepStrictEqual(
            calculateGroupStatusBadge(group, monitorList, heartbeatList, translate),
            {
                text: "Up",
                color: "primary",
            }
        );
    });

    test("returns down when any child is down", () => {
        const heartbeatList = {
            1: [{ status: UP, time: "2026-05-13 12:00:00" }],
            2: [{ status: DOWN, time: "2026-05-13 12:00:00" }],
        };

        assert.strictEqual(calculateGroupStatus(monitors, heartbeatList), DOWN);
    });

    test("returns pending when a child is pending and none are down", () => {
        const heartbeatList = {
            1: [{ status: UP, time: "2026-05-13 12:00:00" }],
            2: [{ status: PENDING, time: "2026-05-13 12:00:00" }],
        };

        assert.strictEqual(calculateGroupStatus(monitors, heartbeatList), PENDING);
    });

    test("returns maintenance when any child is in maintenance", () => {
        const heartbeatList = {
            1: [{ status: UP, time: "2026-05-13 12:00:00" }],
            2: [{ status: MAINTENANCE, time: "2026-05-13 12:00:00" }],
        };

        assert.strictEqual(calculateGroupStatus(monitors, heartbeatList), MAINTENANCE);
    });

    test("returns unknown for empty groups or groups with no heartbeat data", () => {
        assert.strictEqual(calculateGroupStatus([], {}), UNKNOWN);
        assert.strictEqual(calculateGroupStatus(monitors, {}), UNKNOWN);
        assert.strictEqual(calculateGroupUptime([], {}, "24"), null);
    });

    test("returns pending when at least one child is missing heartbeat data while others are up", () => {
        const heartbeatList = {
            1: [{ status: UP, time: "2026-05-13 12:00:00" }],
        };

        assert.strictEqual(calculateGroupStatus(monitors, heartbeatList), PENDING);
    });

    test("builds aggregate heartbeat bars from child heartbeat slots", () => {
        const heartbeatList = {
            1: [
                { status: UP, time: "2026-05-13 12:00:00" },
                { status: UP, time: "2026-05-13 12:01:00" },
            ],
            2: [
                { status: UP, time: "2026-05-13 12:00:00" },
                { status: DOWN, time: "2026-05-13 12:01:00" },
            ],
        };

        assert.deepStrictEqual(
            buildGroupHeartbeatList(monitors, heartbeatList).map((beat) => beat.status),
            [UP, DOWN]
        );
    });

    test("finds active leaf monitors for nested groups", () => {
        const group = { id: 10, type: "group" };
        const monitorList = {
            10: group,
            11: { id: 11, type: "group", parent: 10, active: true },
            12: { id: 12, type: "http", parent: 11, active: true },
            13: { id: 13, type: "http", parent: 10, active: false },
        };

        assert.deepStrictEqual(getGroupChildMonitors(group, monitorList).map((monitor) => monitor.id), [12]);
    });
});
